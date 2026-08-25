/**
 * Shared state for the React bindings.
 *
 * Specification section 12 forbids the public API from accepting account
 * roles, tokens, document keys, or session objects, so the context carries
 * profiles, the active mode, and an editor adapter — nothing else.
 */

import { createContext, useContext } from 'react';

import type {
	EditorAdapter,
	InputMode,
	LanguageProfile,
} from '@starisian/3iatlas-multilingual-input-core';
import type { KeymanFailureReason } from '@starisian/3iatlas-multilingual-input-keyman';

/** Non-content lifecycle events a consumer may subscribe to (section 12). */
export type MultilingualInputEvent =
	| { readonly type: 'mode-changed'; readonly mode: InputMode }
	| { readonly type: 'profile-changed'; readonly profileId: string }
	| { readonly type: 'character-inserted'; readonly profileId: string }
	| {
			readonly type: 'keyman-fallback';
			readonly reason: KeymanFailureReason;
	  };

/** Value exposed to every component beneath the provider. */
export interface MultilingualInputContextValue {
	readonly profiles: readonly LanguageProfile[];
	readonly activeProfile: LanguageProfile | null;
	readonly inputMode: InputMode;
	readonly adapter: EditorAdapter | null;
	readonly setInputMode: (mode: InputMode) => void;
	readonly setActiveProfileId: (profileId: string) => void;
	readonly insertCharacter: (character: string) => void;
	/**
	 * Emits a non-content lifecycle event to the provider's `onEvent`.
	 *
	 * Exposed so that a component which detects an event the provider cannot
	 * see — notably `KeymanKeyboardHost` reporting a fallback — reports it
	 * through the same channel as everything else.
	 */
	readonly emitEvent: (event: MultilingualInputEvent) => void;
}

/** Context backing {@link useMultilingualInput}. */
export const MultilingualInputContext =
	createContext<MultilingualInputContextValue | null>(null);

/**
 * Reads the multilingual input context.
 *
 * @return The context value.
 * @throws When called outside a `MultilingualInputProvider`.
 */
export const useMultilingualInput = (): MultilingualInputContextValue => {
	const value = useContext(MultilingualInputContext);

	if (value === null) {
		throw new Error(
			'useMultilingualInput must be called inside a MultilingualInputProvider.'
		);
	}

	return value;
};
