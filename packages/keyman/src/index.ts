/**
 * KeymanWeb adapter boundary.
 *
 * Specification section 5.4 requires the adapter to isolate KeymanWeb from
 * consumers, attach only to the active supported surface, select a keyboard by
 * profile, pin versions, load assets locally, and fall back to Helper mode when
 * loading fails. Keyman is an optional adapter: Helper mode must never load the
 * engine (section 9).
 *
 * No KeymanWeb engine is bundled here. Consumers may use the real
 * `KeymanWebAdapter` with a licensed, pinned, self-hosted engine, or the
 * `NullKeymanAdapter` when no engine is deployed.
 */

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';
import { validateLanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

/** Why the full keyboard could not be activated. */
export type KeymanFailureReason =
	| 'engine-unavailable'
	| 'keyboard-unavailable'
	| 'no-approved-keyboard'
	| 'licence-not-recorded'
	| 'asset-load-failed'
	| 'keyboard-activation-failed';

/** Result of attempting to activate the full keyboard. */
export type KeymanActivation =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: KeymanFailureReason };

/** Where pinned engine and keyboard assets are served from. */
export interface KeymanAssetSource {
	/** Base URL for self-hosted assets. Remote CDNs are prohibited in production. */
	readonly baseUrl: string;
	/** Engine version this consumer is pinned to. */
	readonly pinnedEngineVersion: string;
}

/**
 * Lifecycle contract for a Keyman-backed input engine.
 *
 * Implementations must attach to only the active supported input surface and
 * must tear down cleanly so that two on-screen keyboards are never presented
 * at once (section 6.4).
 */
export interface KeymanAdapter {
	/** Whether the engine is loaded and usable right now. */
	readonly isAvailable: () => boolean;
	/** Loads the pinned engine. Must be called before activation. */
	readonly initialize: (source: KeymanAssetSource) => Promise<boolean>;
	/** Activates the approved keyboard for a profile. */
	readonly activateProfile: (
		profile: LanguageProfile
	) => Promise<KeymanActivation>;
	/** Detaches the engine and restores the host's native keyboard. */
	readonly teardown: () => Promise<void>;
}

/**
 * The adapter used when no Keyman engine is present.
 *
 * Every activation fails with an explicit reason so the consumer falls back to
 * Helper mode, which section 5.4 requires and section 16 gate 7 makes
 * non-negotiable: failure here must never block ordinary typing.
 */
export class NullKeymanAdapter implements KeymanAdapter {
	public readonly isAvailable = (): boolean => false;

	public readonly initialize = async (
		source: KeymanAssetSource
	): Promise<boolean> => {
		void source;

		return false;
	};

	public readonly activateProfile = async (
		profile: LanguageProfile
	): Promise<KeymanActivation> => {
		void profile;

		return { ok: false, reason: 'engine-unavailable' };
	};

	public readonly teardown = async (): Promise<void> => {
		return undefined;
	};
}

/**
 * Decides whether a profile is eligible for the full Keyman keyboard.
 *
 * Gated on technical availability, NOT on AiWA linguistic validation: a
 * licensed, version-pinned keyboard may be used while its orthography is still
 * under review. What must never happen is describing that keyboard as
 * AiWA-validated, which is `isLinguisticallyValidated`'s job, not this one.
 *
 * @param profile Profile the user selected.
 * @return Null when eligible, otherwise the reason it is refused.
 */
export const checkKeymanEligibility = (
	profile: LanguageProfile
): KeymanFailureReason | null => {
	// Profiles are consumer-supplied and therefore untrusted input (section
	// 10), so blank strings are treated as missing rather than as values.
	const present = (value: string | null | undefined): boolean =>
		typeof value === 'string' && value.trim() !== '';

	if (profile.availability.status !== 'available') {
		return 'keyboard-unavailable';
	}

	// Specific reasons first: they tell the host exactly what is missing.
	if (
		!present(profile.availability.keymanKeyboardId) ||
		!present(profile.availability.pinnedVersion)
	) {
		return 'no-approved-keyboard';
	}

	if (
		!present(profile.availability.metadata?.licence) ||
		!present(profile.availability.metadata?.source)
	) {
		return 'licence-not-recorded';
	}

	// Catch-all: the same evidence rules that govern availability apply here,
	// so a structurally invalid profile never reaches the engine.
	if (!validateLanguageProfile(profile).valid) {
		return 'keyboard-unavailable';
	}

	return null;
};

export type {
	KeymanWebFailureReason,
	KeymanWebGlobal,
	KeymanWebOptions,
} from './keymanweb';
export {
	KeymanWebAdapter,
	createScriptTagEngineLoader,
	isSelfHostedAssetUrl,
} from './keymanweb';
