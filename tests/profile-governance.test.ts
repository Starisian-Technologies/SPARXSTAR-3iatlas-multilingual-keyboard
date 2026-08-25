import { describe, expect, test } from '@jest/globals';

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';
import {
	describeValidationStatus,
	isKeyboardAvailable,
	isLinguisticallyValidated,
	selectAvailableProfiles,
	selectValidatedProfiles,
	validateLanguageProfile,
} from '@starisian/3iatlas-multilingual-input-core';
import {
	ALL_PROFILES,
	MANDINKA_GM_PROFILE,
} from '@starisian/3iatlas-multilingual-input-profiles';

describe('availability is independent of linguistic validation', () => {
	test('profiles are usable so engineering is not blocked', () => {
		// The whole point of the split: work can proceed on these.
		expect(selectAvailableProfiles(ALL_PROFILES).length).toBe(
			ALL_PROFILES.length
		);
	});

	test('no profile is AiWA-validated yet', () => {
		expect(selectValidatedProfiles(ALL_PROFILES)).toEqual([]);

		for (const profile of ALL_PROFILES) {
			expect(isLinguisticallyValidated(profile)).toBe(false);
		}
	});

	test('available and validated are genuinely separate axes', () => {
		// Mandinka is the case that proves the split works: usable today,
		// not certified.
		expect(isKeyboardAvailable(MANDINKA_GM_PROFILE)).toBe(true);
		expect(isLinguisticallyValidated(MANDINKA_GM_PROFILE)).toBe(false);
	});
});

describe('validation status disclosure', () => {
	test('never describes a pending profile as validated', () => {
		const text = describeValidationStatus(MANDINKA_GM_PROFILE);

		expect(text).toContain('Gambian Mandinka');
		expect(text).toContain('Peace Corps The Gambia');
		expect(text).toContain('Not yet validated');
		expect(text).not.toMatch(/—\s*linguistically validated by AiWA/);
	});

	test('names the variant and orthography for every profile', () => {
		for (const profile of ALL_PROFILES) {
			const text = describeValidationStatus(profile);

			expect(text).toContain(profile.validation.variant);
			expect(text.length).toBeGreaterThan(0);
		}
	});
});

describe('evidence requirements', () => {
	test('a profile cannot claim validation without a reviewer and date', () => {
		const forged: LanguageProfile = {
			...MANDINKA_GM_PROFILE,
			validation: {
				...MANDINKA_GM_PROFILE.validation,
				status: 'validated',
				reviewer: null,
				reviewedAt: null,
			},
		};

		const result = validateLanguageProfile(forged);

		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.field)).toEqual(
			expect.arrayContaining([
				'validation.reviewer',
				'validation.reviewedAt',
				'fixtures',
			])
		);
		expect(isLinguisticallyValidated(forged)).toBe(false);
	});

	test('an empty string does not satisfy a required evidence field', () => {
		const forged: LanguageProfile = {
			...MANDINKA_GM_PROFILE,
			validation: {
				...MANDINKA_GM_PROFILE.validation,
				status: 'validated',
				reviewer: '',
				reviewedAt: '',
			},
			fixtures: [{ text: 'x', codePoints: ['0078'] }],
		};

		expect(isLinguisticallyValidated(forged)).toBe(false);
	});

	test('an available keyboard must pin a version and record a licence', () => {
		const unpinned: LanguageProfile = {
			...MANDINKA_GM_PROFILE,
			availability: {
				...MANDINKA_GM_PROFILE.availability,
				pinnedVersion: null,
				metadata: null,
			},
		};

		const issues = validateLanguageProfile(unpinned).issues.map(
			(issue) => issue.field
		);

		expect(issues).toEqual(
			expect.arrayContaining([
				'availability.pinnedVersion',
				'availability.metadata.source',
				'availability.metadata.licence',
			])
		);
		expect(isKeyboardAvailable(unpinned)).toBe(false);
	});

	test('every profile names the variant it claims to represent', () => {
		for (const profile of ALL_PROFILES) {
			expect(profile.validation.variant).not.toBe('');
			expect(profile.validation.orthography).not.toBe('');
			expect(validateLanguageProfile(profile).valid).toBe(true);
		}
	});
});

describe('Gambian Mandinka inventory', () => {
	test('carries the letters absent from a stock Latin keyboard', () => {
		const characters = MANDINKA_GM_PROFILE.helperCharacterGroups.flatMap(
			(group) => group.characters
		);

		expect(characters).toEqual(expect.arrayContaining(['ŋ', 'Ŋ', 'ñ', 'Ñ']));
	});

	test('is not the generic accented-vowel set it replaced', () => {
		const characters = MANDINKA_GM_PROFILE.helperCharacterGroups.flatMap(
			(group) => group.characters
		);

		for (const rejected of ['á', 'à', 'é', 'è', 'í', 'ì', 'ó', 'ò', 'ú', 'ù']) {
			expect(characters).not.toContain(rejected);
		}
	});

	test('writes length by doubling rather than by diacritic', () => {
		const longVowels = MANDINKA_GM_PROFILE.helperCharacterGroups.find(
			(group) => group.label === 'Long vowels'
		);

		expect(longVowels?.characters).toEqual(['aa', 'ee', 'ii', 'oo', 'uu']);
		expect(MANDINKA_GM_PROFILE.combiningRules).toEqual([]);
	});

	test('ships no fixtures, because those must come from the reviewer', () => {
		expect(MANDINKA_GM_PROFILE.fixtures).toEqual([]);
		expect(MANDINKA_GM_PROFILE.validation.reviewer).toBe('Muhammed Dibbasey');
		expect(MANDINKA_GM_PROFILE.validation.status).toBe('pending');
	});
});
