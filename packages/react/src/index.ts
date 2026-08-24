/**
 * React bindings for 3iAtlas multilingual input.
 *
 * React is a peer dependency: consumers that ship only Helper mode without
 * React should depend on `core` and `adapters` directly (section 9).
 */

export type {
	MultilingualInputContextValue,
	MultilingualInputEvent,
} from './context';
export { MultilingualInputContext, useMultilingualInput } from './context';

export type { MultilingualInputProviderProps } from './provider';
export { MultilingualInputProvider } from './provider';

export type {
	InputModeLabels,
	InputModeSelectorProps,
} from './input-mode-selector';
export { InputModeSelector } from './input-mode-selector';

export type { LanguageHelperBarProps } from './language-helper-bar';
export { LanguageHelperBar } from './language-helper-bar';

export type { KeymanKeyboardHostProps } from './keyman-keyboard-host';
export { KeymanKeyboardHost } from './keyman-keyboard-host';
