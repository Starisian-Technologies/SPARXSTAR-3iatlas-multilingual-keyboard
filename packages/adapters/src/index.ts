/**
 * Editor adapters for host writing surfaces.
 *
 * Specification section 5.3 requires Release 1 to ship a native input/textarea
 * adapter, a controlled React input adapter, and a WordPad adapter, and
 * prohibits direct DOM value mutation where a transaction API exists.
 */

import type {
	EditorAdapter,
	InsertResult,
	InsertionRequest,
	TextSelectionState,
} from '@starisian/3iatlas-multilingual-input-core';
import { insertAtSelection } from '@starisian/3iatlas-multilingual-input-core';

/** The subset of a native text control this package relies on. */
export interface NativeTextControl {
	value: string;
	selectionStart: number | null;
	selectionEnd: number | null;
	focus: () => void;
	setSelectionRange: (start: number, end: number) => void;
	dispatchEvent: (event: Event) => boolean;
}

/**
 * Adapter for native `input` and `textarea` elements.
 *
 * Insertion is attempted through `document.execCommand('insertText')` while
 * the control is focused, because that is the only route that keeps the
 * browser's native undo stack intact. When the command is unavailable the
 * adapter falls back to assigning `value` and dispatching an `input` event, and
 * reports the fallback through `usedFallback` so a consumer can surface the
 * reduced undo fidelity in diagnostics (section 13).
 */
export class NativeTextControlAdapter implements EditorAdapter {
	public readonly id = 'native-text-control';

	private readonly control: NativeTextControl;

	private fallbackUsed = false;

	public constructor(control: NativeTextControl) {
		this.control = control;
	}

	/** Whether the last insertion bypassed the native undo stack. */
	public get usedFallback(): boolean {
		return this.fallbackUsed;
	}

	public readonly readSelection = (): TextSelectionState | null => {
		const { value, selectionStart, selectionEnd } = this.control;

		if (selectionStart === null || selectionEnd === null) {
			return null;
		}

		return { value, selectionStart, selectionEnd };
	};

	public readonly insert = (request: InsertionRequest): InsertResult | null => {
		const state = this.readSelection();

		if (state === null) {
			return null;
		}

		this.restoreFocus();
		this.control.setSelectionRange(state.selectionStart, state.selectionEnd);

		if (this.tryExecCommand(request.text)) {
			this.fallbackUsed = false;

			return this.readSelection();
		}

		this.fallbackUsed = true;

		const result = insertAtSelection(state, request.text);

		this.control.value = result.value;
		this.control.setSelectionRange(result.selectionStart, result.selectionEnd);
		this.dispatchInputEvent();

		return result;
	};

	public readonly restoreFocus = (): void => {
		this.control.focus();
	};

	/**
	 * Attempts the transaction-preserving insertion path.
	 *
	 * @param text Text to insert.
	 * @return True when the command was accepted.
	 */
	private tryExecCommand(text: string): boolean {
		const doc = (globalThis as { document?: unknown }).document as
			| { execCommand?: (name: string, ui: boolean, value: string) => boolean }
			| undefined;

		if (typeof doc?.execCommand !== 'function') {
			return false;
		}

		try {
			return doc.execCommand('insertText', false, text);
		} catch {
			return false;
		}
	}

	/** Notifies frameworks that the value changed. */
	private dispatchInputEvent(): void {
		const EventConstructor = (globalThis as { Event?: unknown }).Event as
			(new (type: string, init?: { bubbles: boolean }) => Event) | undefined;

		if (typeof EventConstructor !== 'function') {
			return;
		}

		try {
			this.control.dispatchEvent(
				new EventConstructor('input', { bubbles: true })
			);
		} catch {
			// A host that rejects synthetic events must not break typing.
		}
	}
}

/** Receives the next value of a controlled React input. */
export type ControlledValueSetter = (result: InsertResult) => void;

/**
 * Adapter for a controlled React input.
 *
 * React owns the value, so the adapter computes the next state and hands it to
 * the consumer's setter rather than writing to the DOM.
 */
export class ControlledReactInputAdapter implements EditorAdapter {
	public readonly id = 'controlled-react-input';

	private readonly getState: () => TextSelectionState | null;

	private readonly setValue: ControlledValueSetter;

	private readonly focusControl: () => void;

	public constructor(
		getState: () => TextSelectionState | null,
		setValue: ControlledValueSetter,
		focusControl: () => void
	) {
		this.getState = getState;
		this.setValue = setValue;
		this.focusControl = focusControl;
	}

	public readonly readSelection = (): TextSelectionState | null =>
		this.getState();

	public readonly insert = (request: InsertionRequest): InsertResult | null => {
		const state = this.readSelection();

		if (state === null) {
			return null;
		}

		const result = insertAtSelection(state, request.text);

		this.setValue(result);
		this.restoreFocus();

		return result;
	};

	public readonly restoreFocus = (): void => {
		this.focusControl();
	};
}

/** Transaction API a rich-text host must expose to receive insertions. */
export interface EditorTransactionApi {
	readonly getSelection: () => TextSelectionState | null;
	/** Applies the insertion as one undoable transaction. */
	readonly applyInsertion: (text: string) => InsertResult | null;
	readonly focus: () => void;
}

/**
 * Adapter for the WordPad editor.
 *
 * WordPad is the Release 1 reference integration (section 13). Because it
 * exposes a transaction API, section 5.3 prohibits mutating its DOM value
 * directly, so this adapter delegates every edit to that API. The transaction
 * implementation itself belongs to WordPad and is supplied by the consumer.
 */
export class WordPadEditorAdapter implements EditorAdapter {
	public readonly id = 'wordpad-editor';

	private readonly api: EditorTransactionApi;

	public constructor(api: EditorTransactionApi) {
		this.api = api;
	}

	public readonly readSelection = (): TextSelectionState | null =>
		this.api.getSelection();

	public readonly insert = (request: InsertionRequest): InsertResult | null =>
		this.api.applyInsertion(request.text);

	public readonly restoreFocus = (): void => {
		this.api.focus();
	};
}
