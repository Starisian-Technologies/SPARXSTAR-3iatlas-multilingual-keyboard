/**
 * Editor adapters.
 *
 * Each adapter maps a host editing surface onto the pure insertion helper so
 * that inserted characters never travel through HTML interpretation.
 */

import type { InsertResult, TextSelectionState } from './core';
import { insertAtSelection } from './core';

/** Contract every editing surface must satisfy to receive characters. */
export interface EditorAdapter {
	readonly insertCharacter: (
		state: TextSelectionState,
		character: string
	) => InsertResult;
}

/** Shared selection-based insertion used by the concrete adapters. */
class BaseSelectionAdapter implements EditorAdapter {
	public insertCharacter(
		state: TextSelectionState,
		character: string
	): InsertResult {
		return insertAtSelection( state, character );
	}
}

/** Adapter for native `input` and `textarea` controls. */
export class NativeTextareaAdapter extends BaseSelectionAdapter {}

/** Adapter for controlled React inputs that own their own value. */
export class ControlledReactInputAdapter extends BaseSelectionAdapter {}

/** Adapter for the WordPress rich-text editing surface. */
export class WordPadEditorAdapter extends BaseSelectionAdapter {}
