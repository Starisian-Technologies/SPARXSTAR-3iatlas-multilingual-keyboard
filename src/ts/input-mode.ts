/**
 * Input-mode state contract shared across components.
 *
 * Cross-component state is owned by `@wordpress/data`; this module only
 * describes the shape of that state and the localized options offered to
 * authors.
 */

import { __ } from '@wordpress/i18n';

import type { InputMode, LanguageProfile } from './core';

/** State the keyboard exposes to every consuming component. */
export interface MultilingualInputState {
	readonly activeProfileId: string;
	readonly inputMode: InputMode;
}

/** Configuration required to mount the keyboard into a host element. */
export interface MultilingualInputProviderProps {
	readonly profiles: readonly LanguageProfile[];
	readonly initialProfileId: string;
	readonly initialInputMode: InputMode;
}

/** A selectable input mode paired with its localized label. */
export interface InputModeOption {
	readonly value: InputMode;
	readonly label: string;
}

/**
 * Builds the localized input-mode options.
 *
 * Labels are resolved on call rather than at module scope so that the active
 * locale is the one in effect when the control renders.
 *
 * @return The ordered input-mode options.
 */
export const getInputModeOptions = (): readonly InputModeOption[] => [
	{
		value: 'standard',
		label: __( 'Standard', 'sparxstar-3iatlas-multilingual-keyboard' ),
	},
	{
		value: 'helper',
		label: __( 'Helper', 'sparxstar-3iatlas-multilingual-keyboard' ),
	},
	{
		value: 'full-keyboard',
		label: __( 'Full keyboard', 'sparxstar-3iatlas-multilingual-keyboard' ),
	},
];
