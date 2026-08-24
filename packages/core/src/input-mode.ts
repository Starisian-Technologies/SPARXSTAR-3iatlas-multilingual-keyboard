/**
 * Input-mode contract.
 *
 * Specification section 1 defines three user-selectable modes and section 6.1
 * fixes Helper as the recommended default. Section 6.1 also requires the
 * stored values to remain stable even when labels are localized, so the mode
 * identifiers here are the persisted contract and must not be renamed.
 */

/** The three modes a user may select. */
export type InputMode = 'standard' | 'helper' | 'full-keyboard';

/** Every mode identifier, in presentation order. */
export const INPUT_MODES: readonly InputMode[] = [
	'standard',
	'helper',
	'full-keyboard',
];

/** Recommended default for a first-time user (section 6.1). */
export const DEFAULT_INPUT_MODE: InputMode = 'helper';

/**
 * Narrows an unknown stored value to a valid mode.
 *
 * Stored preferences are untrusted input; an unrecognized value falls back to
 * the documented default rather than throwing.
 *
 * @param value Candidate value from storage.
 * @return The mode when recognized, otherwise the default.
 */
export const parseInputMode = (value: unknown): InputMode =>
	INPUT_MODES.includes(value as InputMode)
		? (value as InputMode)
		: DEFAULT_INPUT_MODE;
