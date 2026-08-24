import { describe, expect, jest, test } from '@jest/globals';

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';
import type {
	KeymanAssetSource,
	KeymanWebGlobal,
} from '@starisian/3iatlas-multilingual-input-keyman';
import {
	KeymanWebAdapter,
	NullKeymanAdapter,
	checkKeymanEligibility,
	isSelfHostedAssetUrl,
} from '@starisian/3iatlas-multilingual-input-keyman';
import { MANDINKA_GM_PROFILE } from '@starisian/3iatlas-multilingual-input-profiles';

const LOCAL_SOURCE: KeymanAssetSource = {
	baseUrl: '/assets/keyman',
	pinnedEngineVersion: '17.0.0',
};

/** A profile with a licensed, pinned Keyman layout bound to it. */
const withKeyboard = (overrides = {}): LanguageProfile => ({
	...MANDINKA_GM_PROFILE,
	availability: {
		...MANDINKA_GM_PROFILE.availability,
		status: 'available',
		keymanKeyboardId: 'sil_pan_africa_positional',
		pinnedVersion: '1.2.0',
		metadata: {
			source: 'keyman.com keyboard catalogue',
			licence: 'MIT',
		},
		...overrides,
	},
});

/** Faithful double of the KeymanWeb global, recording the call sequence. */
const createEngine = (
	failOn?: 'addKeyboards' | 'setActiveKeyboard'
): KeymanWebGlobal & { calls: string[] } => {
	const calls: string[] = [];

	return {
		calls,
		init: (options) => {
			calls.push(`init:${String(options.root)}`);
		},
		addKeyboards: (...specs: string[]) => {
			calls.push(`addKeyboards:${specs.join(',')}`);

			if (failOn === 'addKeyboards') {
				throw new Error('boom');
			}
		},
		setActiveKeyboard: (id: string, lang?: string) => {
			calls.push(`setActiveKeyboard:${id}:${String(lang)}`);

			if (failOn === 'setActiveKeyboard') {
				throw new Error('boom');
			}
		},
		attachToControl: () => {
			calls.push('attach');
		},
		detachFromControl: () => {
			calls.push('detach');
		},
		shutdown: () => {
			calls.push('shutdown');
		},
	};
};

describe('eligibility is gated on availability, not AiWA validation', () => {
	test('a licensed pinned keyboard is eligible while validation is pending', () => {
		const profile = withKeyboard();

		expect(profile.validation.status).toBe('pending');
		// Usable anyway — this is the behavior the split exists to enable.
		expect(checkKeymanEligibility(profile)).toBeNull();
	});

	test('refuses an unavailable keyboard', () => {
		expect(
			checkKeymanEligibility(withKeyboard({ status: 'unavailable' }))
		).toBe('keyboard-unavailable');
	});

	test('refuses an unpinned keyboard', () => {
		expect(checkKeymanEligibility(withKeyboard({ pinnedVersion: null }))).toBe(
			'no-approved-keyboard'
		);
	});

	test('refuses a keyboard with no recorded licence', () => {
		expect(checkKeymanEligibility(withKeyboard({ metadata: null }))).toBe(
			'licence-not-recorded'
		);
	});
});

describe('self-hosting requirement', () => {
	test('accepts a relative path and rejects a third-party CDN', () => {
		expect(isSelfHostedAssetUrl('/assets/keyman')).toBe(true);
		expect(isSelfHostedAssetUrl('https://cdn.example.com/keyman')).toBe(false);
	});

	test('initialize refuses a CDN source without loading anything', async () => {
		const loadEngine = jest.fn();
		const adapter = new KeymanWebAdapter({
			target: {},
			loadEngine: loadEngine as never,
		});

		await expect(
			adapter.initialize({
				baseUrl: 'https://cdn.example.com/keyman',
				pinnedEngineVersion: '17.0.0',
			})
		).resolves.toBe(false);
		expect(loadEngine).not.toHaveBeenCalled();
	});
});

describe('KeymanWebAdapter lifecycle', () => {
	test('initializes, activates the pinned keyboard, and attaches', async () => {
		const engine = createEngine();
		const target = { id: 'editor' };
		const adapter = new KeymanWebAdapter({
			target,
			loadEngine: async () => engine,
		});

		expect(await adapter.initialize(LOCAL_SOURCE)).toBe(true);
		expect(adapter.isAvailable()).toBe(true);

		const activation = await adapter.activateProfile(withKeyboard());

		expect(activation.ok).toBe(true);
		expect(engine.calls).toEqual([
			'init:/assets/keyman',
			'addKeyboards:sil_pan_africa_positional@1.2.0',
			'setActiveKeyboard:sil_pan_africa_positional:mnk-Latn-GM',
			'attach',
		]);
		expect(adapter.getActiveKeyboardId()).toBe('sil_pan_africa_positional');
	});

	test('detaches the previous keyboard before switching', async () => {
		const engine = createEngine();
		const adapter = new KeymanWebAdapter({
			target: {},
			loadEngine: async () => engine,
		});

		await adapter.initialize(LOCAL_SOURCE);
		await adapter.activateProfile(withKeyboard());
		engine.calls.length = 0;

		await adapter.activateProfile(
			withKeyboard({ keymanKeyboardId: 'other_keyboard' })
		);

		// Detach must precede the new attach: never two live layouts.
		expect(engine.calls[0]).toBe('detach');
		expect(engine.calls).toContain('attach');
		expect(adapter.getActiveKeyboardId()).toBe('other_keyboard');
	});

	test('tears down and detaches', async () => {
		const engine = createEngine();
		const adapter = new KeymanWebAdapter({
			target: {},
			loadEngine: async () => engine,
		});

		await adapter.initialize(LOCAL_SOURCE);
		await adapter.activateProfile(withKeyboard());
		engine.calls.length = 0;

		await adapter.teardown();

		expect(engine.calls).toEqual(['detach', 'shutdown']);
		expect(adapter.isAvailable()).toBe(false);
		expect(adapter.getActiveKeyboardId()).toBeNull();
	});

	test('reports engine load failure instead of throwing', async () => {
		const adapter = new KeymanWebAdapter({
			target: {},
			loadEngine: async () => {
				throw new Error('network down');
			},
		});

		expect(await adapter.initialize(LOCAL_SOURCE)).toBe(false);

		const activation = await adapter.activateProfile(withKeyboard());

		expect(activation).toEqual({
			ok: false,
			reason: 'engine-unavailable',
		});
	});

	test('times out a hanging engine rather than blocking typing', async () => {
		const adapter = new KeymanWebAdapter({
			target: {},
			loadEngine: () => new Promise(() => undefined),
			timeoutMs: 20,
		});

		expect(await adapter.initialize(LOCAL_SOURCE)).toBe(false);
	});

	test('recovers to a clean state when activation fails midway', async () => {
		const engine = createEngine('setActiveKeyboard');
		const adapter = new KeymanWebAdapter({
			target: {},
			loadEngine: async () => engine,
		});

		await adapter.initialize(LOCAL_SOURCE);

		const activation = await adapter.activateProfile(withKeyboard());

		expect(activation).toEqual({
			ok: false,
			reason: 'keyboard-activation-failed',
		});
		// Must not leave a half-attached engine behind.
		expect(adapter.isAvailable()).toBe(false);
		expect(adapter.getActiveKeyboardId()).toBeNull();
	});
});

describe('NullKeymanAdapter fallback', () => {
	test('reports unavailability instead of pretending to activate', async () => {
		const adapter = new NullKeymanAdapter();

		expect(adapter.isAvailable()).toBe(false);
		await expect(adapter.initialize(LOCAL_SOURCE)).resolves.toBe(false);

		const activation = await adapter.activateProfile(MANDINKA_GM_PROFILE);

		expect(activation.ok).toBe(false);
		await expect(adapter.teardown()).resolves.toBeUndefined();
	});
});
