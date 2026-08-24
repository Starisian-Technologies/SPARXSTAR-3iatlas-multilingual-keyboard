/**
 * Input-mode preference contract.
 *
 * Specification section 6.2 scopes a preference by user, device, language
 * profile, and optionally product, and forbids preference storage from
 * containing typed text. Section 12 forbids the API from accepting account
 * roles, tokens, or session objects, so the scope carries opaque identifiers
 * only and storage is delegated to a consumer-provided adapter.
 */

import type { InputMode } from './input-mode';
import { DEFAULT_INPUT_MODE, parseInputMode } from './input-mode';

/** Identifies which preference is being read or written. */
export interface PreferenceScope {
	/** Opaque user identifier, or null for an anonymous local preference. */
	readonly userId: string | null;
	/** Opaque device or browser identifier. */
	readonly deviceId: string;
	/** Language profile the preference applies to. */
	readonly profileId: string;
	/** Product identifier, only when the user chose an explicit override. */
	readonly productId: string | null;
}

/** Storage supplied by the consuming product. */
export interface PreferenceAdapter {
	readonly read: (key: string) => string | null;
	readonly write: (key: string, value: string) => void;
}

/**
 * Builds the storage key for a scope.
 *
 * The key contains only opaque identifiers. It never contains typed text.
 *
 * @param scope Preference scope.
 * @return A stable, collision-resistant key.
 */
export const buildPreferenceKey = (scope: PreferenceScope): string =>
	[
		'3iatlas',
		'input-mode',
		scope.userId ?? 'anonymous',
		scope.deviceId,
		scope.profileId,
		scope.productId ?? 'default',
	]
		.map((part) => encodeURIComponent(part))
		.join(':');

/**
 * Reads the stored mode for a scope.
 *
 * A missing or unrecognized value yields the documented default rather than
 * an error, so a corrupted preference can never block typing (section 16
 * gate 7).
 *
 * @param adapter Consumer-provided storage.
 * @param scope   Preference scope.
 * @return The stored mode, or the default.
 */
export const readInputModePreference = (
	adapter: PreferenceAdapter,
	scope: PreferenceScope
): InputMode => {
	try {
		return parseInputMode(adapter.read(buildPreferenceKey(scope)));
	} catch {
		return DEFAULT_INPUT_MODE;
	}
};

/**
 * Stores the mode for a scope.
 *
 * Storage failure is swallowed: a preference that cannot be persisted must not
 * prevent the user from typing.
 *
 * @param adapter Consumer-provided storage.
 * @param scope   Preference scope.
 * @param mode    Mode to persist.
 */
export const writeInputModePreference = (
	adapter: PreferenceAdapter,
	scope: PreferenceScope,
	mode: InputMode
): void => {
	try {
		adapter.write(buildPreferenceKey(scope), mode);
	} catch {
		// Intentionally ignored — see section 16 gate 7.
	}
};
