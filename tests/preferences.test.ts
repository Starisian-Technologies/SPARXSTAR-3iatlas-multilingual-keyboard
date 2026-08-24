import { describe, expect, test } from '@jest/globals';

import type {
	PreferenceAdapter,
	PreferenceScope,
} from '@starisian/3iatlas-multilingual-input-core';
import {
	DEFAULT_INPUT_MODE,
	buildPreferenceKey,
	parseInputMode,
	readInputModePreference,
	writeInputModePreference,
} from '@starisian/3iatlas-multilingual-input-core';

const createStore = (): PreferenceAdapter & { map: Map<string, string> } => {
	const map = new Map<string, string>();

	return {
		map,
		read: (key) => map.get(key) ?? null,
		write: (key, value) => {
			map.set(key, value);
		},
	};
};

const scope = (overrides: Partial<PreferenceScope> = {}): PreferenceScope => ({
	userId: null,
	deviceId: 'device-1',
	profileId: 'wolof-latn-sn',
	productId: null,
	...overrides,
});

describe('preference isolation', () => {
	test('separates preferences by profile, device, user, and product', () => {
		const keys = new Set([
			buildPreferenceKey(scope()),
			buildPreferenceKey(scope({ profileId: 'fula-latn-sn' })),
			buildPreferenceKey(scope({ deviceId: 'device-2' })),
			buildPreferenceKey(scope({ userId: 'user-1' })),
			buildPreferenceKey(scope({ productId: 'wordpad' })),
		]);

		expect(keys.size).toBe(5);
	});

	test('round-trips a stored mode', () => {
		const store = createStore();

		writeInputModePreference(store, scope(), 'full-keyboard');

		expect(readInputModePreference(store, scope())).toBe('full-keyboard');
		expect(readInputModePreference(store, scope({ deviceId: 'other' }))).toBe(
			DEFAULT_INPUT_MODE
		);
	});

	test('stores no typed text in the key', () => {
		expect(buildPreferenceKey(scope({ userId: 'user-1' }))).toBe(
			'3iatlas:input-mode:user-1:device-1:wolof-latn-sn:default'
		);
	});

	test('falls back to the default when storage throws', () => {
		const throwing: PreferenceAdapter = {
			read: () => {
				throw new Error('storage unavailable');
			},
			write: () => {
				throw new Error('storage unavailable');
			},
		};

		expect(readInputModePreference(throwing, scope())).toBe(DEFAULT_INPUT_MODE);
		// Must not throw: a broken preference cannot block typing.
		expect(() =>
			writeInputModePreference(throwing, scope(), 'standard')
		).not.toThrow();
	});

	test('defaults to helper mode for a first-time user', () => {
		expect(DEFAULT_INPUT_MODE).toBe('helper');
		expect(parseInputMode('nonsense')).toBe('helper');
		expect(parseInputMode(undefined)).toBe('helper');
	});
});
