import { describe, expect, jest, test } from '@jest/globals';

import type { TextSelectionState } from '@starisian/3iatlas-multilingual-input-core';
import {
	ControlledReactInputAdapter,
	WordPadEditorAdapter,
} from '@starisian/3iatlas-multilingual-input-adapters';
import { isEditorAdapter } from '@starisian/3iatlas-multilingual-input-core';

describe('controlled react input adapter', () => {
	test('computes the next value and hands it to the consumer setter', () => {
		const state: TextSelectionState = {
			value: 'be',
			selectionStart: 2,
			selectionEnd: 2,
		};
		const setValue = jest.fn();
		const focus = jest.fn();
		const adapter = new ControlledReactInputAdapter(
			() => state,
			setValue,
			focus
		);

		const result = adapter.insert({ text: 'ɗ', profileId: 'fula-latn-sn' });

		expect(result?.value).toBe('beɗ');
		expect(setValue).toHaveBeenCalledWith(
			expect.objectContaining({ value: 'beɗ', selectionStart: 3 })
		);
		// Focus must return to the editor after a helper-bar press.
		expect(focus).toHaveBeenCalled();
	});

	test('does nothing when the surface is not focused', () => {
		const setValue = jest.fn();
		const adapter = new ControlledReactInputAdapter(
			() => null,
			setValue,
			jest.fn()
		);

		expect(adapter.insert({ text: 'ɗ', profileId: 'fula-latn-sn' })).toBeNull();
		expect(setValue).not.toHaveBeenCalled();
	});
});

describe('wordpad editor adapter', () => {
	test('delegates every edit to the host transaction API', () => {
		const applyInsertion = jest.fn(() => ({
			value: 'ŋa',
			selectionStart: 1,
			selectionEnd: 1,
		}));
		const adapter = new WordPadEditorAdapter({
			getSelection: () => ({
				value: 'a',
				selectionStart: 0,
				selectionEnd: 0,
			}),
			applyInsertion,
			focus: jest.fn(),
		});

		adapter.insert({ text: 'ŋ', profileId: 'wolof-latn-sn' });

		// Section 5.3 prohibits direct DOM mutation when a transaction API exists.
		expect(applyInsertion).toHaveBeenCalledWith('ŋ');
	});
});

describe('adapter contract', () => {
	test('recognizes a conforming adapter and rejects a malformed one', () => {
		const adapter = new WordPadEditorAdapter({
			getSelection: () => null,
			applyInsertion: () => null,
			focus: () => undefined,
		});

		expect(isEditorAdapter(adapter)).toBe(true);
		expect(isEditorAdapter({ id: 'x' })).toBe(false);
		expect(isEditorAdapter(null)).toBe(false);
	});
});
