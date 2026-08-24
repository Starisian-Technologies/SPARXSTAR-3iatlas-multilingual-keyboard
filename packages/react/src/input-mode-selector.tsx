/**
 * Input-mode selector.
 *
 * Specification section 6.1 requires a control offering Standard, Helper, and
 * Full keyboard, with localizable labels but stable stored values. Section 11
 * requires keyboard navigation, visible focus, screen-reader labels, and no
 * colour-only state.
 */

import type { InputMode } from '@starisian/3iatlas-multilingual-input-core';
import { INPUT_MODES } from '@starisian/3iatlas-multilingual-input-core';

import { useMultilingualInput } from './context';

/** Labels supplied by the consuming product, already localized. */
export type InputModeLabels = Readonly<Record<InputMode, string>>;

/** Props accepted by {@link InputModeSelector}. */
export interface InputModeSelectorProps {
	/** Localized labels. The consumer owns translation (section 6.1). */
	readonly labels: InputModeLabels;
	/** Accessible name for the group. */
	readonly legend: string;
	/** Modes to hide, e.g. Full keyboard before Phase 2 ships. */
	readonly hiddenModes?: readonly InputMode[];
}

/**
 * Renders the mode selector as a native radio group.
 *
 * Native radios are used so that arrow-key navigation, focus, and screen-reader
 * semantics come from the platform rather than being reimplemented.
 *
 * @param props Selector configuration.
 * @return The selector element.
 */
export const InputModeSelector = ({
	labels,
	legend,
	hiddenModes = [],
}: InputModeSelectorProps): JSX.Element => {
	const { inputMode, setInputMode } = useMultilingualInput();
	const visibleModes = INPUT_MODES.filter(
		(mode) => !hiddenModes.includes(mode)
	);

	return (
		<fieldset className="tiatlas-input-mode-selector">
			<legend>{legend}</legend>
					<input
						type="radio"
						name={`tiatlas-input-mode-${legend}`}
						value={mode}
						checked={inputMode === mode}
						onChange={() => setInputMode(mode)}
					/>
					<span>{labels[mode]}</span>
				</label>
			))}
		</fieldset>
	);
};
