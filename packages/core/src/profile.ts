/**
 * Language-profile schema, keyboard availability, and linguistic validation.
 *
 * Two independent questions are tracked separately, because conflating them
 * either blocks shippable engineering work or makes false claims about a
 * language:
 *
 * 1. **Technical availability** — is there a licensed, version-pinned keyboard
 *    that loads and passes input tests? If so the profile can be selected and
 *    used.
 * 2. **Linguistic validation** — has AiWA reviewed the exact language,
 *    orthography, script, and regional variant? Only then may the profile be
 *    described as AiWA-validated.
 *
 * A profile may be available without being validated. It must never be
 * presented as validated without the review (specification section 4:
 * "claim support for a language merely because its characters render" is
 * prohibited; section 16 gate 10 forbids broad unsupported claims).
 */

/** Writing direction of a profile's script. */
export type TextDirection = 'ltr' | 'rtl';

/** Unicode normalization form declared by a profile. */
export type NormalizationForm = 'NFC' | 'NFD' | 'NFKC' | 'NFKD';

/**
 * Whether a keyboard may be selected and used.
 *
 * `available` — licensed, version-pinned, and verified to load and accept
 * input. `unavailable` — not yet licensed, pinned, or tested.
 */
export type AvailabilityStatus = 'available' | 'unavailable';

/**
 * Whether AiWA has reviewed the orthography.
 *
 * `validated` — a named AiWA reviewer completed the section 14.3 acceptance
 * procedure for this exact variant. `pending` — review is scheduled or in
 * progress with a named reviewer. `not-reviewed` — nobody has looked at it.
 */
export type ValidationStatus = 'validated' | 'pending' | 'not-reviewed';

/** Licensing and sourcing for a shipped keyboard or inventory. */
export interface SourceMetadata {
	/** Human-readable citation for where this came from. */
	readonly source: string;
	/** Licence governing redistribution. */
	readonly licence: string;
}

/**
 * Technical availability of the keyboard for a profile.
 *
 * This says nothing about orthographic correctness. It says the software can
 * be loaded and typed with.
 */
export interface KeyboardAvailability {
	readonly status: AvailabilityStatus;
	/** Keyman keyboard identifier, when a Keyman layout backs this profile. */
	readonly keymanKeyboardId: string | null;
	/** Exact pinned keyboard version. Required when available. */
	readonly pinnedVersion: string | null;
	/** Licence and source for the keyboard package. Required when available. */
	readonly metadata: SourceMetadata | null;
	/** Notes on what was tested to justify the availability claim. */
	readonly verifiedBy: string;
}

/**
 * AiWA linguistic review of a specific orthography and variant.
 *
 * The variant and orthography fields are required regardless of status,
 * because a profile must always state which variant it claims to represent —
 * an unreviewed profile that does not even name its target cannot be reviewed.
 */
export interface LinguisticValidation {
	readonly status: ValidationStatus;
	/** Exact regional variant, e.g. 'Gambian Mandinka'. */
	readonly variant: string;
	/** Named orthography, e.g. 'Peace Corps The Gambia'. */
	readonly orthography: string;
	/** AiWA reviewer, named as soon as one is assigned. */
	readonly reviewer: string | null;
	/** ISO 8601 date the review completed. Null until validated. */
	readonly reviewedAt: string | null;
	/** Revision identifier for the reviewed inventory. */
	readonly revision: string;
	/** Provenance and licence for the character inventory itself. */
	readonly metadata: SourceMetadata;
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
	readonly metadata: SourceMetadata | null;
}

/** Declarative description of one language's input behavior. */
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
	readonly availability: KeyboardAvailability;
	readonly validation: LinguisticValidation;
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
 * Validates a profile's structure and the evidence behind its claims.
 *
 * A profile is rejected in full rather than partially repaired.
 *
 * @param profile Candidate profile.
 * @return Validation result listing every issue found.
 */
export const validateLanguageProfile = (
	profile: LanguageProfile
): ProfileValidationResult => {
	const issues: ProfileValidationIssue[] = [];

	const check = (condition: boolean, field: string, message: string): void => {
		if (!condition) {
			issues.push({ field, message });
		}
	};

	const required = (value: string, field: string, message: string): void => {
		check(value !== '', field, message);
	};

	required(profile.id, 'id', 'Profile identifier must not be empty.');
	required(profile.bcp47Tag, 'bcp47Tag', 'A BCP 47 language tag is required.');
	required(
		profile.writingSystem,
		'writingSystem',
		'Writing system must be declared.'
	);

	check(
		profile.helperCharacterGroups.length > 0,
		'helperCharacterGroups',
		'At least one helper character group is required.'
	);
	check(
		profile.helperCharacterGroups.every((group) => group.characters.length > 0),
		'helperCharacterGroups',
		'Every helper character group must contain characters.'
	);

	// A profile must always name the variant and orthography it claims to
	// represent, whether or not it has been reviewed. Without that, review is
	// impossible and the claim is unfalsifiable.
	required(
		profile.validation.variant,
		'validation.variant',
		'The regional variant this profile claims must be named.'
	);
	required(
		profile.validation.orthography,
		'validation.orthography',
		'The orthography this profile follows must be named.'
	);
	required(
		profile.validation.metadata.source,
		'validation.metadata.source',
		'The inventory source must be cited.'
	);
	required(
		profile.validation.metadata.licence,
		'validation.metadata.licence',
		'The inventory licence must be recorded.'
	);

	// Availability requires the licence, pin, and verification behind it.
	if (profile.availability.status === 'available') {
		required(
			profile.availability.pinnedVersion ?? '',
			'availability.pinnedVersion',
			'An available keyboard must pin an exact version.'
		);
		required(
			profile.availability.metadata?.source ?? '',
			'availability.metadata.source',
			'An available keyboard must cite its source.'
		);
		required(
			profile.availability.metadata?.licence ?? '',
			'availability.metadata.licence',
			'An available keyboard must record its licence.'
		);
		required(
			profile.availability.verifiedBy,
			'availability.verifiedBy',
			'An available keyboard must record what verified it.'
		);
	}

	// Validation requires a named reviewer, a date, and code-point fixtures.
	if (profile.validation.status === 'validated') {
		required(
			profile.validation.reviewer ?? '',
			'validation.reviewer',
			'A validated profile must name its AiWA reviewer.'
		);
		required(
			profile.validation.reviewedAt ?? '',
			'validation.reviewedAt',
			'A validated profile must record its review date.'
		);
		required(
			profile.validation.revision,
			'validation.revision',
			'A validated profile must record its revision.'
		);
		check(
			profile.fixtures.length > 0,
			'fixtures',
			'A validated profile must ship code-point fixtures.'
		);
	}

	return { valid: issues.length === 0, issues };
};

/**
 * Reports whether a profile's keyboard may be selected and used.
 *
 * This is the gate for offering a language in the input UI. It deliberately
 * does not require linguistic validation, so that engineering and product work
 * can proceed on a licensed, tested keyboard.
 *
 * @param profile Profile to test.
 * @return True when the keyboard is available and the profile is structurally valid.
 */
export const isKeyboardAvailable = (profile: LanguageProfile): boolean =>
	profile.availability.status === 'available' &&
	validateLanguageProfile(profile).valid;

/**
 * Reports whether AiWA has validated this profile's orthography.
 *
 * This is the ONLY gate for describing a language as AiWA-validated, certified,
 * or approved in any user-facing surface, documentation, or marketing.
 *
 * @param profile Profile to test.
 * @return True only when a named reviewer validated this exact variant.
 */
export const isLinguisticallyValidated = (profile: LanguageProfile): boolean =>
	profile.validation.status === 'validated' &&
	validateLanguageProfile(profile).valid;

/**
 * Filters profiles down to those whose keyboards may be offered.
 *
 * @param profiles Profiles to filter.
 * @return The available profiles.
 */
export const selectAvailableProfiles = (
	profiles: readonly LanguageProfile[]
): readonly LanguageProfile[] => profiles.filter(isKeyboardAvailable);

/**
 * Filters profiles down to those AiWA has validated.
 *
 * @param profiles Profiles to filter.
 * @return The validated profiles.
 */
export const selectValidatedProfiles = (
	profiles: readonly LanguageProfile[]
): readonly LanguageProfile[] => profiles.filter(isLinguisticallyValidated);

/**
 * Builds the disclosure a UI must show alongside a profile.
 *
 * Consumers should render this verbatim rather than inventing their own
 * wording, so that an unvalidated profile is never described as certified.
 *
 * @param profile Profile being offered.
 * @return A short, honest status sentence.
 */
export const describeValidationStatus = (profile: LanguageProfile): string => {
	switch (profile.validation.status) {
		case 'validated':
			return `${profile.validation.variant} (${profile.validation.orthography}) — linguistically validated by AiWA.`;
		case 'pending':
			return `${profile.validation.variant} (${profile.validation.orthography}) — AiWA linguistic review in progress. Not yet validated.`;
		default:
			return `${profile.validation.variant} (${profile.validation.orthography}) — not reviewed by AiWA. Orthography unverified.`;
	}
};
