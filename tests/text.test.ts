import { describe, expect, test } from '@jest/globals';

import {
	insertAtSelection,
	nextGraphemeBoundary,
	normalizeInputText,
	previousGraphemeBoundary,
	toCodePoints,
	toGraphemes,
} from '@starisian/3iatlas-multilingual-input-core';

describe('insertion', () => {
	test('replaces the selection and collapses the caret after it', () => {
		const result = insertAtSelection(
			{ value: 'N ka taa', selectionStart: 2, selectionEnd: 4 },
			'ñ'
		);

		expect(result.value).toBe('N ñ taa');
		expect(result.selectionStart).toBe(3);
		expect(result.selectionEnd).toBe(3);
	});

	test('inserts at a collapsed caret without removing text', () => {
		const result = insertAtSelection(
			{ value: 'ka taa', selectionStart: 0, selectionEnd: 0 },
			'ŋ'
		);

		expect(result.value).toBe('ŋka taa');
		expect(result.selectionStart).toBe(1);
	});

	test('handles a backwards selection', () => {
		const result = insertAtSelection(
			{ value: 'abcd', selectionStart: 3, selectionEnd: 1 },
			'X'
		);

		expect(result.value).toBe('aXd');
		expect(result.selectionStart).toBe(2);
	});
});

describe('normalization', () => {
	test('composes a decomposed sequence under NFC', () => {
		const decomposed = 'é';

		expect(normalizeInputText(decomposed, 'NFC')).toBe('é');
		expect(toCodePoints(normalizeInputText(decomposed, 'NFC'))).toEqual([
			'00E9',
		]);
	});

	test('decomposes under NFD', () => {
		expect(toCodePoints(normalizeInputText('é', 'NFD'))).toEqual([
			'0065',
			'0301',
		]);
	});
});

describe('grapheme-safe cursor movement', () => {
	test('treats a base plus combining mark as one cluster', () => {
		const value = 'éx';

		expect(toGraphemes(value)[0]).toBe('é');
		expect(previousGraphemeBoundary(value, 2)).toBe(0);
	});

	test('does not split a surrogate pair', () => {
		const value = '\u{1F600}a';

		expect(nextGraphemeBoundary(value, 0)).toBe(2);
		expect(previousGraphemeBoundary(value, 2)).toBe(0);
	});

	test('clamps at both ends', () => {
		expect(previousGraphemeBoundary('abc', 0)).toBe(0);
		expect(nextGraphemeBoundary('abc', 3)).toBe(3);
	});
});
