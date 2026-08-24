/**
 * Provider component.
 *
 * Specification section 5.2 requires a `MultilingualInputProvider` that owns
 * product-facing state and lifecycle. Text never leaves the editor adapter, so
 * the provider holds mode and profile selection only (section 10).
 */

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type {
	EditorAdapter,
	InputMode,
	LanguageProfile,
} from '@starisian/3iatlas-multilingual-input-core';
import {
	DEFAULT_INPUT_MODE,
	normalizeInputText,
} from '@starisian/3iatlas-multilingual-input-core';

import type {
	MultilingualInputContextValue,
	MultilingualInputEvent,
} from './context';
import { MultilingualInputContext } from './context';

/** Props accepted by {@link MultilingualInputProvider}. */
export interface MultilingualInputProviderProps {
	/** Profiles this product ships (section 13). */
	readonly profiles: readonly LanguageProfile[];
	/** Profile selected at mount. */
	readonly initialProfileId?: string;
	/** Mode selected at mount. Defaults to Helper (section 6.1). */
	readonly initialInputMode?: InputMode;
	/** Adapter for the host writing surface. */
	readonly adapter?: EditorAdapter | null;
	/** Receives non-content lifecycle events only. */
	readonly onEvent?: (event: MultilingualInputEvent) => void;
	readonly children?: ReactNode;
}

/**
 * Supplies multilingual input state to its subtree.
 *
 * @param props Provider configuration.
 * @return The provider element.
 */
export const MultilingualInputProvider = ({
	profiles,
	initialProfileId,
	initialInputMode = DEFAULT_INPUT_MODE,
	adapter = null,
	onEvent,
	children,
}: MultilingualInputProviderProps): JSX.Element => {
	const [inputMode, setInputModeState] = useState<InputMode>(initialInputMode);
	const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
		initialProfileId ?? profiles[0]?.id ?? null
	);

	const activeProfile = useMemo(
		() => profiles.find((profile) => profile.id === activeProfileId) ?? null,
		[profiles, activeProfileId]
	);

	const setInputMode = useCallback(
		(mode: InputMode) => {
			setInputModeState(mode);
			onEvent?.({ type: 'mode-changed', mode });
		},
		[onEvent]
	);

	const setActiveProfileId = useCallback(
		(profileId: string) => {
			setActiveProfileIdState(profileId);
			onEvent?.({ type: 'profile-changed', profileId });
		},
		[onEvent]
	);

	const insertCharacter = useCallback(
		(character: string) => {
			if (adapter === null || activeProfile === null) {
				return;
			}

			// Normalize to the profile's declared form at this documented
			// boundary (section 7) before the adapter sees the text.
			const text = normalizeInputText(
				character,
				activeProfile.normalizationForm
			);

			adapter.insert({ text, profileId: activeProfile.id });
			adapter.restoreFocus();
			onEvent?.({
				type: 'character-inserted',
				profileId: activeProfile.id,
			});
		},
		[adapter, activeProfile, onEvent]
	);

	const value = useMemo<MultilingualInputContextValue>(
		() => ({
			profiles,
			activeProfile,
			inputMode,
			adapter,
			setInputMode,
			setActiveProfileId,
			insertCharacter,
		}),
		[
			profiles,
			activeProfile,
			inputMode,
			adapter,
			setInputMode,
			setActiveProfileId,
			insertCharacter,
		]
	);

	return (
		<MultilingualInputContext.Provider value={value}>
			{children}
		</MultilingualInputContext.Provider>
	);
};
