/**
 * KeymanWeb adapter boundary.
 *
 * Specification section 5.4 requires the adapter to isolate KeymanWeb from
 * consumers, attach only to the active supported surface, select a keyboard by
 * profile, pin versions, load assets locally, and fall back to Helper mode when
 * loading fails. Keyman is an optional adapter: Helper mode must never load the
 * engine (section 9).
 *
 * No KeymanWeb engine is bundled here. Section 15 places engine integration in
 * Phase 2, after keyboard and font licensing is recorded (section 16 gate 6).
 * `NullKeymanAdapter` is therefore the only implementation that ships today,
 * and it reports unavailability rather than pretending to activate.
 */

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

/** Why the full keyboard could not be activated. */
export type KeymanFailureReason =
	| 'engine-unavailable'
	| 'no-approved-keyboard'
	| 'asset-load-failed'
	| 'profile-not-approved';

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
 * Decides whether a profile is eligible for the full keyboard.
 *
 * Section 5.4 permits only approved keyboard selection by profile, and section
 * 4 forbids claiming support without linguistic review, so an unapproved
 * profile is refused before any asset is fetched.
 *
 * @param profile Profile the user selected.
 * @return Null when eligible, otherwise the reason it is refused.
 */
export const checkKeymanEligibility = (
	profile: LanguageProfile
): KeymanFailureReason | null => {
	if (profile.approval.status !== 'approved') {
		return 'profile-not-approved';
	}

	if (
		profile.keyman.keyboardId === null ||
		profile.keyman.pinnedVersion === null
	) {
		return 'no-approved-keyboard';
	}

	return null;
};
