import { describe, expect, jest, test } from '@jest/globals';

import type { TextSelectionState } from '@starisian/3iatlas-multilingual-input-core';
import {
	ContentEditableAdapter,
	ControlledReactInputAdapter,
	NativeTextControlAdapter,
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

describe('native text control adapter', () => {
	test('never reports failure for an insertion that actually happened', () => {
		// Simulates a control whose selection is momentarily unreadable right
		// after a successful execCommand.
		let selectionReadable = true;

		const control = {
			value: 'ba',
			selectionStart: 2 as number | null,
			selectionEnd: 2 as number | null,
			focus: () => undefined,
			setSelectionRange: () => undefined,
			dispatchEvent: () => true,
		};

		Object.defineProperty(control, 'selectionStart', {
			get: () => (selectionReadable ? 2 : null),
		});
		Object.defineProperty(control, 'selectionEnd', {
			get: () => (selectionReadable ? 2 : null),
		});

		const doc = globalThis.document as unknown as {
			execCommand?: unknown;
		};
		const original = doc.execCommand;

		doc.execCommand = () => {
			// Command succeeds, then the selection becomes unreadable.
			selectionReadable = false;

			return true;
		};

		try {
			const adapter = new NativeTextControlAdapter(control);
			const result = adapter.insert({
				text: 'ŋ',
				profileId: 'wolof-latn-sn',
			});

			expect(result).not.toBeNull();
			expect(result?.value).toBe('baŋ');
			expect(adapter.usedFallback).toBe(false);
		} finally {
			doc.execCommand = original;
		}
	});
});

describe('ContentEditableAdapter', () => {
	test('inserts through a Range rather than replacing markup', () => {
		document.body.innerHTML = '<div id="host" contenteditable>ba</div>';

		const host = document.getElementById('host') as HTMLDivElement;
		const textNode = host.firstChild as Text;
		const range = document.createRange();

		range.setStart(textNode, 2);
		range.setEnd(textNode, 2);

		const selection = window.getSelection();

		selection?.removeAllRanges();
		selection?.addRange(range);

		const adapter = new ContentEditableAdapter(host);
		const result = adapter.insert({
			text: 'ŋ',
			profileId: 'mandinka-latn-gm',
		});

		expect(result?.value).toBe('baŋ');
		expect(host.textContent).toBe('baŋ');
	});

	test('returns null when there is no selection', () => {
		document.body.innerHTML = '<div id="empty" contenteditable></div>';

		const host = document.getElementById('empty') as HTMLDivElement;

		window.getSelection()?.removeAllRanges();

		expect(
			new ContentEditableAdapter(host).insert({
				text: 'ŋ',
				profileId: 'mandinka-latn-gm',
			})
		).toBeNull();
	});
});
