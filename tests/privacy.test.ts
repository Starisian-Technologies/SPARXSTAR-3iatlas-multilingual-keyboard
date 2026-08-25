import { describe, expect, test } from '@jest/globals';

import type { PreferenceAdapter } from '@starisian/3iatlas-multilingual-input-core';
import {
	buildPreferenceKey,
	writeInputModePreference,
} from '@starisian/3iatlas-multilingual-input-core';

/**
 * Specification section 10: no keystrokes, composed words, document fragments,
 * clipboard contents, or character sequences may be logged or transmitted.
 */
describe('typed text never leaves the editor', () => {
	test('preference keys contain only opaque identifiers', () => {
		const key = buildPreferenceKey({
			userId: 'user-1',
			deviceId: 'device-1',
			profileId: 'mandinka-latn-gm',
			productId: 'wordpad',
		});

		expect(key).toBe(
			'3iatlas:input-mode:user-1:device-1:mandinka-latn-gm:wordpad'
		);
	});

	test('only the mode is persisted, never text', () => {
		const written: Array<[string, string]> = [];
		const store: PreferenceAdapter = {
			read: () => null,
			write: (key, value) => {
				written.push([key, value]);
			},
		};

		writeInputModePreference(
			store,
			{
				userId: null,
				deviceId: 'device-1',
				profileId: 'mandinka-latn-gm',
				productId: null,
			},
			'helper'
		);

		expect(written).toEqual([
			[
				'3iatlas:input-mode:anonymous:device-1:mandinka-latn-gm:default',
				'helper',
			],
		]);

		for (const [key, value] of written) {
			// Neither half may carry a Mandinka character.
			expect(/[ŋñŊÑ]/.test(key)).toBe(false);
			expect(/[ŋñŊÑ]/.test(value)).toBe(false);
		}
	});
});
