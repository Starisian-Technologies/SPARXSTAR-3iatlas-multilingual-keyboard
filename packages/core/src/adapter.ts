/**
 * Editor adapter interface.
 *
 * Specification section 5.3 requires adapters to translate an insertion into
 * the host editor's native transaction model, and prohibits direct DOM value
 * mutation when the host exposes a transaction API. Each adapter must preserve
 * selection, focus, undo/redo, composition events, history boundaries, and
 * grapheme-safe cursor movement.
 */

import type { InsertResult, TextSelectionState } from './text';

/** A request to insert approved text at the current selection. */
export interface InsertionRequest {
	/** Text to insert, already normalized for the active profile. */
	readonly text: string;
	/** Profile the text was drawn from, for diagnostics only. */
	readonly profileId: string;
}

/**
 * Contract every editing surface must satisfy to receive characters.
 *
 * Implementations are responsible for routing the insertion through whatever
 * transaction API the host provides so that undo/redo stays coherent.
 */
export interface EditorAdapter {
	/** Stable identifier for diagnostics (section 13). */
	readonly id: string;
	/** Reads the current selection, or null when the surface is not focused. */
	readonly readSelection: () => TextSelectionState | null;
	/** Applies an insertion through the host's transaction model. */
	readonly insert: (request: InsertionRequest) => InsertResult | null;
	/** Returns focus to the editing surface after a helper-bar press. */
	readonly restoreFocus: () => void;
}

/**
 * Reports whether an object satisfies the adapter contract.
 *
 * Consumers supply adapters, so they are untrusted input (section 10).
 *
 * @param candidate Value to test.
 * @return True when every required member is present.
 */
export const isEditorAdapter = (
	candidate: unknown
): candidate is EditorAdapter => {
	if (typeof candidate !== 'object' || candidate === null) {
		return false;
	}

	const adapter = candidate as Partial<EditorAdapter>;

	return (
		typeof adapter.id === 'string' &&
		typeof adapter.readSelection === 'function' &&
		typeof adapter.insert === 'function' &&
		typeof adapter.restoreFocus === 'function'
	);
};
