/**
 * Grapheme-safe text primitives.
 *
 * Specification section 7 requires cursor calculations to be grapheme-aware
 * rather than assuming UTF-16 code units, and requires combining marks to
 * attach to the intended base character. These helpers are pure and hold no
 * state, so no typed text is retained (section 10).
 */

import type { NormalizationForm } from './profile';

/** Snapshot of a text control taken immediately before an edit. */
export interface TextSelectionState {
	readonly value: string;
	readonly selectionStart: number;
	readonly selectionEnd: number;
}

/** Value and caret position produced by an edit. */
export interface InsertResult {
	readonly value: string;
	readonly selectionStart: number;
	readonly selectionEnd: number;
}

/**
 * Splits a string into grapheme clusters.
 *
 * Uses `Intl.Segmenter` where available. The fallback splits on code points
 * rather than code units, which still keeps surrogate pairs intact even though
 * it cannot group combining sequences.
 *
 * @param value Text to segment.
 * @return The grapheme clusters in order.
 */
export const toGraphemes = (value: string): readonly string[] => {
	const Segmenter = (Intl as { Segmenter?: unknown }).Segmenter as
		| (new (
				locales?: string,
				options?: { granularity: string }
		  ) => { segment: (input: string) => Iterable<{ segment: string }> })
		| undefined;

	if (typeof Segmenter === 'function') {
		try {
			const segments = new Segmenter(undefined, {
				granularity: 'grapheme',
			}).segment(value);

			return Array.from(segments, (entry) => entry.segment);
		} catch {
			// Fall through to the code-point split below.
		}
	}

	// Code-point split keeps surrogate pairs intact even though it cannot
	// group combining sequences.
	return Array.from(value);
};

/**
 * Applies a normalization form to text.
 *
 * @param input             Text to normalize.
 * @param normalizationForm Form declared by the active profile.
 * @return The normalized text.
 */
export const normalizeInputText = (
	input: string,
	normalizationForm: NormalizationForm
): string => input.normalize(normalizationForm);

/**
 * Replaces the current selection with text and collapses the caret after it.
 *
 * Never touches the DOM and never retains the text it is given; the caller
 * owns writing the result back through an editor adapter.
 *
 * @param state        Snapshot of the target control.
 * @param insertedText Text to insert in place of the selection.
 * @return The resulting value and caret position.
 */
export const insertAtSelection = (
	state: TextSelectionState,
	insertedText: string
): InsertResult => {
	const start = Math.min(state.selectionStart, state.selectionEnd);
	const end = Math.max(state.selectionStart, state.selectionEnd);
	const value = `${state.value.slice(
		0,
		start
	)}${insertedText}${state.value.slice(end)}`;
	const caret = start + insertedText.length;

	return { value, selectionStart: caret, selectionEnd: caret };
};

/**
 * Moves an index left by one grapheme cluster rather than one code unit.
 *
 * @param value Text being navigated.
 * @param index Current index.
 * @return The index at the previous grapheme boundary.
 */
export const previousGraphemeBoundary = (
	value: string,
	index: number
): number => {
	if (index <= 0) {
		return 0;
	}

	let offset = 0;

	for (const grapheme of toGraphemes(value)) {
		const next = offset + grapheme.length;

		if (next >= index) {
			return offset;
		}

		offset = next;
	}

	return offset;
};

/**
 * Moves an index right by one grapheme cluster rather than one code unit.
 *
 * @param value Text being navigated.
 * @param index Current index.
 * @return The index at the next grapheme boundary.
 */
export const nextGraphemeBoundary = (value: string, index: number): number => {
	if (index >= value.length) {
		return value.length;
	}

	let offset = 0;

	for (const grapheme of toGraphemes(value)) {
		const next = offset + grapheme.length;

		if (offset >= index) {
			return next;
		}

		offset = next;
	}

	return value.length;
};

/**
 * Lists the Unicode code points of a string as hex strings.
 *
 * Used by profile fixtures (section 14.1) to assert exact code-point
 * sequences rather than comparing rendered glyphs.
 *
 * @param value Text to describe.
 * @return Upper-case hex code points, e.g. `['0065', '0301']`.
 */
export const toCodePoints = (value: string): readonly string[] =>
	Array.from(value, (character) => {
		const point = character.codePointAt(0) ?? 0;

		return point.toString(16).toUpperCase().padStart(4, '0');
	});
