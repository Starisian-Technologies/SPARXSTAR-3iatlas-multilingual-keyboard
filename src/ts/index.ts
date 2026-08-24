/**
 * Build-time entry point for the 3iAtlas browser bundle.
 *
 * Product behavior is added here only after its contract is approved in the
 * technical specification. This module re-exports the approved scaffold
 * surface using named exports only.
 */

/** Identifies the scaffold bundle version for diagnostics and asset metadata. */
export const BUILD_VERSION = '0.1.0';

export type {
	InputMode,
	InsertResult,
	LanguageProfile,
	ProfileCharacterGroup,
	TextSelectionState,
} from './core';
export {
	insertAtSelection,
	normalizeInputText,
	validateLanguageProfile,
} from './core';

export type { EditorAdapter } from './adapters';
export {
	ControlledReactInputAdapter,
	NativeTextareaAdapter,
	WordPadEditorAdapter,
} from './adapters';

export type { KeymanAdapter } from './keyman';
export { NoopKeymanAdapter } from './keyman';

export type {
	InputModeOption,
	MultilingualInputProviderProps,
	MultilingualInputState,
} from './input-mode';
export { getInputModeOptions } from './input-mode';

export {
	FULA_PROFILE,
	MANDINKA_PROFILE,
	RELEASE_ONE_PROFILES,
	WOLOF_PROFILE,
} from './profiles';
