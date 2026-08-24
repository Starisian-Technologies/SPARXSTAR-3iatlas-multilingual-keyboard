/**
 * Core input types and pure text-manipulation helpers.
 *
 * Every export here is deterministic and free of DOM or network access so the
 * behavior can be validated in isolation before it reaches an editor surface.
 */

/** Selects how much assistive input surface is presented to the author. */
export type InputMode = 'standard' | 'helper' | 'full-keyboard';

/** A labeled set of helper characters offered for a single language. */
export interface ProfileCharacterGroup {
	readonly label: string;
	readonly characters: readonly string[];
}

/** Declarative description of one supported language. */
export interface LanguageProfile {
	readonly id: string;
	readonly bcp47Tag: string;
	readonly displayName: string;
	readonly autonym: string;
	readonly direction: 'ltr' | 'rtl';
	readonly normalizationForm: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
	readonly helperCharacterGroups: readonly ProfileCharacterGroup[];
}

/** Snapshot of a text control taken immediately before an insertion. */
export interface TextSelectionState {
	readonly value: string;
	readonly selectionStart: number;
	readonly selectionEnd: number;
}

/** Value and caret position produced by an insertion. */
export interface InsertResult {
	readonly value: string;
	readonly selectionStart: number;
	readonly selectionEnd: number;
}

/**
 * Reports whether a profile is complete enough to be selectable.
 *
 * A profile is rejected outright rather than partially repaired, matching the
 * layout contract in the technical specification.
 *
 * @param profile Candidate profile to validate.
 * @return True when the profile may be offered to authors.
 */
export const validateLanguageProfile = (
	profile: LanguageProfile
): boolean => {
	if ( profile.id === '' || profile.bcp47Tag === '' ) {
		return false;
	}

	if ( profile.helperCharacterGroups.length === 0 ) {
		return false;
	}

	return profile.helperCharacterGroups.every(
		( group ) => group.characters.length > 0
	);
};

/**
 * Applies a profile's Unicode normalization form to arbitrary text.
 *
 * @param input             Text to normalize.
 * @param normalizationForm Normalization form declared by the active profile.
 * @return The normalized text.
 */
export const normalizeInputText = (
	input: string,
	normalizationForm: LanguageProfile[ 'normalizationForm' ]
): string => input.normalize( normalizationForm );

/**
 * Replaces the current selection with text and returns the collapsed caret.
 *
 * The caller owns writing the result back to the control; this helper never
 * touches the DOM and never retains the text it is given.
 *
 * @param state        Snapshot of the target control.
 * @param insertedText Text to insert in place of the selection.
 * @return The resulting value and caret position.
 */
export const insertAtSelection = (
	state: TextSelectionState,
	insertedText: string
): InsertResult => {
	const start = state.selectionStart;
	const end = state.selectionEnd;
	const value = `${ state.value.slice(
		0,
		start
	) }${ insertedText }${ state.value.slice( end ) }`;
	const nextSelection = start + insertedText.length;

	return {
		value,
		selectionStart: nextSelection,
		selectionEnd: nextSelection,
	};
};
