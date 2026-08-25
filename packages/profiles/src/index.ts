/**
 * Language profiles.
 *
 * Availability and linguistic validation are tracked separately. A profile
 * listed here may be selectable and typable while its orthography is still
 * under AiWA review — see `isKeyboardAvailable` versus
 * `isLinguisticallyValidated` in core.
 *
 * NO PROFILE IN THIS PACKAGE IS AiWA-VALIDATED YET.
 * `selectValidatedProfiles(ALL_PROFILES)` returns an empty array.
 * Consumers must render `describeValidationStatus` rather than inventing
 * their own wording (specification section 4, section 16 gate 10).
 *
 * See `docs/PROFILE-REVIEW.md` for per-language review state.
 */

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

export { MANDINKA_GM_PROFILE } from './mandinka';

import { MANDINKA_GM_PROFILE } from './mandinka';

/**
 * Wolof — engineering unblocked, orthography NOT reviewed.
 *
 * Section 17 leaves open whether Release 1 follows the Senegalese official
 * orthography exclusively, so this profile names that as its target but claims
 * no review. The inventory is carried over from the initial scaffold and has
 * not been checked against any source.
 */
export const WOLOF_SN_PROFILE: LanguageProfile = {
	id: 'wolof-latn-sn',
	bcp47Tag: 'wo-Latn-SN',
	displayName: 'Wolof',
	autonym: 'Wolof',
	writingSystem: 'Latn',
	direction: 'ltr',
	normalizationForm: 'NFC',
	baseCharacters: [],
	helperCharacterGroups: [
		{
			label: 'Extended letters',
			characters: ['ñ', 'Ñ', 'ŋ', 'Ŋ', 'à', 'é', 'ë', 'ó'],
		},
	],
	caseRelationships: [
		{ lower: 'ñ', upper: 'Ñ' },
		{ lower: 'ŋ', upper: 'Ŋ' },
	],
	combiningRules: [],
	fixtures: [],
	fonts: { preferred: null, fallbackStack: [], metadata: null },
	availability: {
		status: 'available',
		keymanKeyboardId: null,
		pinnedVersion: '0.1.0-helper-only',
		metadata: {
			source: 'Helper-bar inventory shipped with this package.',
			licence: 'Proprietary — Starisian Technologies.',
		},
		verifiedBy: 'Automated insertion and normalization tests only.',
	},
	validation: {
		status: 'not-reviewed',
		variant: 'Senegalese Wolof',
		orthography: 'Senegalese official orthography (target, unconfirmed)',
		reviewer: null,
		reviewedAt: null,
		revision: 'draft-0',
		metadata: {
			source:
				'Carried over from the initial scaffold. No orthographic source ' +
				'was cited and none has been verified.',
			licence: 'Unknown — inventory not cleared.',
		},
	},
};

/**
 * Fula / Fulfulde — engineering unblocked, orthography NOT reviewed.
 *
 * Section 17 leaves the regional variant split unresolved. This profile
 * asserts a single Senegalese variant, which presupposes an answer, so it
 * claims no review.
 */
export const FULA_SN_PROFILE: LanguageProfile = {
	id: 'fula-latn-sn',
	bcp47Tag: 'ff-Latn-SN',
	displayName: 'Fula',
	autonym: 'Fulfulde',
	writingSystem: 'Latn',
	direction: 'ltr',
	normalizationForm: 'NFC',
	baseCharacters: [],
	helperCharacterGroups: [
		{
			label: 'Extended letters',
			characters: ['ɓ', 'Ɓ', 'ɗ', 'Ɗ', 'ƴ', 'Ƴ', 'ñ', 'ŋ'],
		},
	],
	caseRelationships: [
		{ lower: 'ɓ', upper: 'Ɓ' },
		{ lower: 'ɗ', upper: 'Ɗ' },
		{ lower: 'ƴ', upper: 'Ƴ' },
	],
	combiningRules: [],
	fixtures: [],
	fonts: { preferred: null, fallbackStack: [], metadata: null },
	availability: {
		status: 'available',
		keymanKeyboardId: null,
		pinnedVersion: '0.1.0-helper-only',
		metadata: {
			source: 'Helper-bar inventory shipped with this package.',
			licence: 'Proprietary — Starisian Technologies.',
		},
		verifiedBy: 'Automated insertion and normalization tests only.',
	},
	validation: {
		status: 'not-reviewed',
		variant: 'Unresolved — regional variant split not decided (section 17)',
		orthography: 'Unresolved',
		reviewer: null,
		reviewedAt: null,
		revision: 'draft-0',
		metadata: {
			source:
				'Carried over from the initial scaffold. No orthographic source ' +
				'was cited and none has been verified.',
			licence: 'Unknown — inventory not cleared.',
		},
	},
};

/** Every profile shipped by this package. */
export const ALL_PROFILES: readonly LanguageProfile[] = [
	MANDINKA_GM_PROFILE,
	WOLOF_SN_PROFILE,
	FULA_SN_PROFILE,
];
