/**
 * Language-profile schema and approval governance.
 *
 * Specification section 5.5 requires every profile to carry its orthographic
 * inventory *and* the evidence that a qualified reviewer approved it. Section 4
 * forbids claiming support for a language merely because its characters render,
 * and forbids substituting a generic Pan-African inventory for linguistic
 * review. This module encodes both rules as types and runtime checks so that an
 * unreviewed profile cannot be presented as supported.
 */

/** Writing direction of a profile's script. */
export type TextDirection = 'ltr' | 'rtl';

/** Unicode normalization form declared by a profile. */
export type NormalizationForm = 'NFC' | 'NFD' | 'NFKC' | 'NFKD';

/**
 * Whether a profile has passed linguistic acceptance.
 *
 * `provisional` — the inventory is a working draft. It may be loaded for
 * development and review, but it must never be described as a supported
 * language. `approved` — a named reviewer completed the section 14.3
 * acceptance procedure on a recorded date.
 */
export type ProfileApprovalStatus = 'provisional' | 'approved';

/** Where an inventory came from and under what terms it may be used. */
export interface ProfileProvenance {
	/** Human-readable citation for the orthographic source. */
	readonly source: string;
	/** Licence governing reuse of the inventory data. */
	readonly licence: string;
	/** Documented variant or dialect scope this profile claims. */
	readonly variantScope: string;
}

/**
 * Record of linguistic acceptance under specification section 14.3.
 *
 * Every field must be populated for a profile to be approved. A profile that
 * has not been reviewed carries `null`, which is the honest representation of
 * "nobody has signed off on this".
 */
export interface ProfileApproval {
	readonly status: ProfileApprovalStatus;
	/** Named reviewer who performed acceptance, or null when unreviewed. */
	readonly reviewer: string | null;
	/** ISO 8601 date of approval, or null when unreviewed. */
	readonly approvedAt: string | null;
	/** Revision identifier for the reviewed inventory. */
	readonly revision: string;
}

/** A labeled set of helper-bar characters grouped by function. */
export interface ProfileCharacterGroup {
	readonly label: string;
	readonly characters: readonly string[];
}

/** An uppercase/lowercase pairing that case transforms must honor. */
export interface CaseRelationship {
	readonly lower: string;
	readonly upper: string;
}

/** A combining mark and the base characters it may legally attach to. */
export interface CombiningRule {
	readonly mark: string;
	readonly permittedBases: readonly string[];
}

/** A sample word and the exact code points it must produce. */
export interface ProfileFixture {
	readonly text: string;
	/** Expected code points, as hex strings, after normalization. */
	readonly codePoints: readonly string[];
}

/** Approved font and fallback stack for rendering the profile's script. */
export interface ProfileFonts {
	readonly preferred: string | null;
	readonly fallbackStack: readonly string[];
	readonly licence: string | null;
}

/** Approved Keyman keyboard binding, pinned to a version. */
export interface ProfileKeymanBinding {
	readonly keyboardId: string | null;
	readonly pinnedVersion: string | null;
	readonly licence: string | null;
}

/**
 * Declarative description of one language's input behavior.
 *
 * Field set follows specification section 5.5. Fields that record review,
 * licensing, fonts, and Keyman bindings are required by the type precisely so
 * that an incomplete profile is visible rather than silently absent.
 */
export interface LanguageProfile {
	readonly id: string;
	readonly bcp47Tag: string;
	readonly displayName: string;
	readonly autonym: string | null;
	readonly writingSystem: string;
	readonly direction: TextDirection;
	readonly normalizationForm: NormalizationForm;
	readonly baseCharacters: readonly string[];
	readonly helperCharacterGroups: readonly ProfileCharacterGroup[];
	readonly caseRelationships: readonly CaseRelationship[];
	readonly combiningRules: readonly CombiningRule[];
	readonly fixtures: readonly ProfileFixture[];
	readonly fonts: ProfileFonts;
	readonly keyman: ProfileKeymanBinding;
	readonly provenance: ProfileProvenance;
	readonly approval: ProfileApproval;
}

/** Reason a profile failed structural validation. */
export interface ProfileValidationIssue {
	readonly field: string;
	readonly message: string;
}

/** Outcome of validating a profile. */
export interface ProfileValidationResult {
	readonly valid: boolean;
	readonly issues: readonly ProfileValidationIssue[];
}

/**
 * Validates a profile's structure.
 *
 * A profile is rejected in full rather than partially repaired. Structural
 * validity is necessary but not sufficient for support: see
 * {@link isSupportedProfile}.
 *
 * @param profile Candidate profile.
 * @return Validation result listing every issue found.
 */
export const validateLanguageProfile = (
	profile: LanguageProfile
): ProfileValidationResult => {
	const issues: ProfileValidationIssue[] = [];

	const require = (
		condition: boolean,
		field: string,
		message: string
	): void => {
		if (!condition) {
			issues.push({ field, message });
		}
	};

	require(profile.id !== '', 'id', 'Profile identifier must not be empty.');
	require(profile.bcp47Tag !==
		'', 'bcp47Tag', 'A BCP 47 language tag is required.');
	require(profile.writingSystem !==
		'', 'writingSystem', 'Writing system must be declared.');
	require(profile.helperCharacterGroups.length >
		0, 'helperCharacterGroups', 'At least one helper character group is required.');
	require(profile.helperCharacterGroups.every(
		(group) => group.characters.length > 0
	), 'helperCharacterGroups', 'Every helper character group must contain characters.');
	require(profile.provenance.source !==
		'', 'provenance.source', 'Orthographic source must be cited.');
	require(profile.provenance.licence !==
		'', 'provenance.licence', 'Inventory licence must be recorded.');

	// An approved profile must carry the evidence of its approval. This is the
	// rule that stops an unreviewed inventory from being marked supported.
	if (profile.approval.status === 'approved') {
		require(profile.approval.reviewer !== null &&
			profile.approval.reviewer !==
				'', 'approval.reviewer', 'An approved profile must name its linguistic reviewer.');
		require(profile.approval.approvedAt !==
			null, 'approval.approvedAt', 'An approved profile must record its approval date.');
		require(profile.fixtures.length >
			0, 'fixtures', 'An approved profile must ship code-point fixtures.');
	}

	return { valid: issues.length === 0, issues };
};

/**
 * Reports whether a profile may be presented to users as a supported language.
 *
 * Specification section 4 forbids claiming support without linguistic review,
 * and section 16 gate 10 forbids broad unsupported claims. Consumers must gate
 * any "supported languages" listing on this function rather than on the mere
 * presence of a profile.
 *
 * @param profile Profile to test.
 * @return True only when the profile is structurally valid and approved.
 */
export const isSupportedProfile = (profile: LanguageProfile): boolean =>
	profile.approval.status === 'approved' &&
	validateLanguageProfile(profile).valid;

/**
 * Filters a set of profiles down to those that may be called supported.
 *
 * @param profiles Profiles to filter.
 * @return Only the approved, structurally valid profiles.
 */
export const selectSupportedProfiles = (
	profiles: readonly LanguageProfile[]
): readonly LanguageProfile[] => profiles.filter(isSupportedProfile);
