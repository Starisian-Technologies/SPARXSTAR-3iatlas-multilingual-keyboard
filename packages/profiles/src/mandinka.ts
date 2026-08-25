/**
 * Gambian Mandinka — first end-to-end integration profile.
 *
 * Product decision: Gambian Mandinka written in the Peace Corps The Gambia
 * orthography already adopted by AiWA.
 *
 * STATUS: keyboard available, AiWA linguistic validation PENDING with
 * Muhammed Dibbasey. This profile may be selected and typed with. It must NOT
 * be described as AiWA-validated until the review completes.
 *
 * Inventory basis and its limits
 * ------------------------------
 * The previous inventory for this profile was ten accented Latin vowels
 * (á à é è í ì ó ò ú ù). That is a generic diacritic set, not a Mandinka
 * repertoire, and it has been removed rather than carried forward.
 *
 * The replacement below reflects the Latin orthography used for Mandinka in
 * The Gambia, whose distinguishing characteristics are the two non-ASCII
 * letters `ŋ` (U+014B LATIN SMALL LETTER ENG) and `ñ` (U+00F1), long vowels
 * written as doubled vowels rather than with diacritics, and no tone marking
 * in practical writing. Those are the characters a Gambian Mandinka writer
 * cannot produce from a stock QWERTY/AZERTY keyboard, which is exactly what
 * the helper bar exists to supply.
 *
 * This inventory was NOT verified against the Peace Corps source document:
 * that document was not reachable from the build environment. It is therefore
 * a reviewed-by-nobody starting point for Muhammed Dibbasey's acceptance
 * review, not a validated inventory, and `validation.status` says so. The
 * fixtures below are intentionally empty: sample words and their expected
 * code-point sequences must come from the reviewer, not from an engineer.
 */

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

/**
 * Gambian Mandinka.
 *
 * Available for engineering and product use; awaiting AiWA validation.
 */
export const MANDINKA_GM_PROFILE: LanguageProfile = {
	id: 'mandinka-latn-gm',
	bcp47Tag: 'mnk-Latn-GM',
	displayName: 'Mandinka',
	autonym: 'Mandinka',
	writingSystem: 'Latn',
	direction: 'ltr',
	normalizationForm: 'NFC',
	baseCharacters: [
		'a',
		'b',
		'c',
		'd',
		'e',
		'f',
		'g',
		'h',
		'i',
		'j',
		'k',
		'l',
		'm',
		'n',
		'ñ',
		'ŋ',
		'o',
		'p',
		'r',
		's',
		't',
		'u',
		'w',
		'y',
	],
	helperCharacterGroups: [
		{
			// The two letters absent from a stock Latin keyboard.
			label: 'Mandinka letters',
			characters: ['ŋ', 'Ŋ', 'ñ', 'Ñ'],
		},
		{
			// Long vowels are written doubled in this orthography, so the
			// helper bar offers them as single insertions.
			label: 'Long vowels',
			characters: ['aa', 'ee', 'ii', 'oo', 'uu'],
		},
	],
	caseRelationships: [
		{ lower: 'ŋ', upper: 'Ŋ' },
		{ lower: 'ñ', upper: 'Ñ' },
	],
	// This orthography writes length by vowel doubling and does not mark tone,
	// so no combining sequences are permitted until review says otherwise.
	combiningRules: [],
	// Fixtures must come from the AiWA reviewer. Deliberately empty.
	fixtures: [],
	fonts: {
		preferred: null,
		fallbackStack: [],
		metadata: null,
	},
	availability: {
		status: 'available',
		keymanKeyboardId: null,
		pinnedVersion: '0.1.0-helper-only',
		metadata: {
			source: 'Helper-bar inventory shipped with this package.',
			licence: 'Proprietary — Starisian Technologies.',
		},
		verifiedBy:
			'Automated insertion, normalization, and grapheme tests plus the ' +
			'browser integration suite. No Keyman layout is bound yet.',
	},
	validation: {
		status: 'pending',
		variant: 'Gambian Mandinka',
		orthography: 'Peace Corps The Gambia',
		reviewer: 'Muhammed Dibbasey',
		reviewedAt: null,
		revision: 'draft-1',
		metadata: {
			source:
				'Latin orthography for Mandinka as used in The Gambia. NOT yet ' +
				'checked against the Peace Corps The Gambia source document, ' +
				'which was unreachable from the build environment.',
			licence: 'Orthography is not copyrightable; inventory pending review.',
		},
	},
};
