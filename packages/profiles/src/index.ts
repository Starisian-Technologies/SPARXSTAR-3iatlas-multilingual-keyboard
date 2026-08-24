/**
 * Draft language profiles.
 *
 * NONE OF THESE PROFILES IS APPROVED. Every profile in this module carries
 * `approval.status: 'provisional'`, which means no qualified reviewer has
 * completed the linguistic acceptance procedure in specification section 14.3.
 *
 * Specification section 4 forbids claiming support for a language merely
 * because its characters render, and section 16 gate 10 forbids broad
 * unsupported claims. Consumers must therefore gate any user-facing
 * "supported languages" listing on `isSupportedProfile`, which returns false
 * for everything exported here until review is recorded.
 *
 * The inventories below are carried forward from the initial scaffold as
 * review input only. They were assembled without a cited orthographic source
 * and have not been checked against any official alphabet. They are known to
 * be incomplete — see `docs/PROFILE-REVIEW.md` for the specific open concerns,
 * including a substantive doubt about the Mandinka inventory. They are
 * deliberately left as found rather than amended, because section 4 forbids
 * replacing linguistic review with an engineer's guess.
 */

import type {
	LanguageProfile,
	ProfileApproval,
	ProfileFonts,
	ProfileKeymanBinding,
} from '@starisian/3iatlas-multilingual-input-core';

/** Approval record shared by every unreviewed draft profile. */
const UNREVIEWED: ProfileApproval = {
	status: 'provisional',
	reviewer: null,
	approvedAt: null,
	revision: 'draft-0',
};

/** No font has been licence-reviewed or coverage-tested yet (section 8). */
const NO_APPROVED_FONT: ProfileFonts = {
	preferred: null,
	fallbackStack: [],
	licence: null,
};

/** No Keyman keyboard has been evaluated or licence-cleared yet (section 5.4). */
const NO_KEYMAN_BINDING: ProfileKeymanBinding = {
	keyboardId: null,
	pinnedVersion: null,
	licence: null,
};

/**
 * Mandinka — DRAFT, NOT APPROVED, INVENTORY DISPUTED.
 *
 * The helper inventory here contains only accented Latin vowels. Mandinka
 * orthography is generally understood to require characters this list does not
 * contain, so the inventory is very likely wrong as well as unreviewed. It is
 * retained verbatim as the artifact under review. Do not ship it, and do not
 * "correct" it outside the review process — section 17 records that the
 * canonical Mandinka orthography for Release 1 is still an open decision.
 */
export const MANDINKA_DRAFT_PROFILE: LanguageProfile = {
	id: 'mandinka-latn-gm',
	bcp47Tag: 'mnk-Latn-GM',
	displayName: 'Mandinka',
	autonym: null,
	writingSystem: 'Latn',
	direction: 'ltr',
	normalizationForm: 'NFC',
	baseCharacters: [],
	helperCharacterGroups: [
		{
			label: 'Vowels with diacritics',
			characters: ['á', 'à', 'é', 'è', 'í', 'ì', 'ó', 'ò', 'ú', 'ù'],
		},
	],
	caseRelationships: [],
	combiningRules: [],
	fixtures: [],
	fonts: NO_APPROVED_FONT,
	keyman: NO_KEYMAN_BINDING,
	provenance: {
		source: 'UNCITED — assembled without an orthographic source.',
		licence: 'UNKNOWN — not cleared for redistribution.',
		variantScope: 'UNDEFINED — variant and dialect scope not documented.',
	},
	approval: UNREVIEWED,
};

/** Wolof — DRAFT, NOT APPROVED. Inventory uncited and unverified. */
export const WOLOF_DRAFT_PROFILE: LanguageProfile = {
	id: 'wolof-latn-sn',
	bcp47Tag: 'wo-Latn-SN',
	displayName: 'Wolof',
	autonym: null,
	writingSystem: 'Latn',
	direction: 'ltr',
	normalizationForm: 'NFC',
	baseCharacters: [],
	helperCharacterGroups: [
		{
			label: 'Extended letters',
			characters: ['ñ', 'ŋ', 'à', 'é', 'ë', 'ó'],
		},
	],
	caseRelationships: [],
	combiningRules: [],
	fixtures: [],
	fonts: NO_APPROVED_FONT,
	keyman: NO_KEYMAN_BINDING,
	provenance: {
		source: 'UNCITED — assembled without an orthographic source.',
		licence: 'UNKNOWN — not cleared for redistribution.',
		variantScope:
			'UNDEFINED — Senegalese official orthography not confirmed as canonical.',
	},
	approval: UNREVIEWED,
};

/** Fula / Fulfulde — DRAFT, NOT APPROVED. Regional variant split unresolved. */
export const FULA_DRAFT_PROFILE: LanguageProfile = {
	id: 'fula-latn-sn',
	bcp47Tag: 'ff-Latn-SN',
	displayName: 'Fula',
	autonym: null,
	writingSystem: 'Latn',
	direction: 'ltr',
	normalizationForm: 'NFC',
	baseCharacters: [],
	helperCharacterGroups: [
		{
			label: 'Extended letters',
			characters: ['ɓ', 'ɗ', 'ƴ', 'ñ', 'ŋ'],
		},
	],
	caseRelationships: [],
	combiningRules: [],
	fixtures: [],
	fonts: NO_APPROVED_FONT,
	keyman: NO_KEYMAN_BINDING,
	provenance: {
		source: 'UNCITED — assembled without an orthographic source.',
		licence: 'UNKNOWN — not cleared for redistribution.',
		variantScope:
			'UNDEFINED — section 17 leaves the regional variant split unresolved.',
	},
	approval: UNREVIEWED,
};

/**
 * Every draft profile in this package.
 *
 * Named `DRAFT` rather than `RELEASE_ONE` deliberately: there is no release-one
 * profile set until linguistic acceptance is recorded. Passing this array to
 * `selectSupportedProfiles` currently yields an empty array, which is the
 * correct and intended result.
 */
export const DRAFT_PROFILES: readonly LanguageProfile[] = [
	MANDINKA_DRAFT_PROFILE,
	WOLOF_DRAFT_PROFILE,
	FULA_DRAFT_PROFILE,
];
