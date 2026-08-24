import { describe, expect, test } from '@jest/globals';

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';
import {
	isSupportedProfile,
	selectSupportedProfiles,
	validateLanguageProfile,
} from '@starisian/3iatlas-multilingual-input-core';
import {
	DRAFT_PROFILES,
	MANDINKA_DRAFT_PROFILE,
} from '@starisian/3iatlas-multilingual-input-profiles';

describe('profile approval governance', () => {
	test('no shipped profile counts as supported', () => {
		expect(selectSupportedProfiles(DRAFT_PROFILES)).toEqual([]);
	});

	test('every shipped profile is explicitly provisional', () => {
		for (const profile of DRAFT_PROFILES) {
			expect(profile.approval.status).toBe('provisional');
			expect(profile.approval.reviewer).toBeNull();
			expect(profile.approval.approvedAt).toBeNull();
			expect(isSupportedProfile(profile)).toBe(false);
		}
	});

	test('a profile cannot claim approval without a named reviewer', () => {
		const forged: LanguageProfile = {
			...MANDINKA_DRAFT_PROFILE,
			approval: {
				status: 'approved',
				reviewer: null,
				approvedAt: null,
				revision: 'forged',
			},
		};

		const result = validateLanguageProfile(forged);

		expect(result.valid).toBe(false);
		expect(result.issues.map((issue) => issue.field)).toEqual(
			expect.arrayContaining([
				'approval.reviewer',
				'approval.approvedAt',
				'fixtures',
			])
		);
		expect(isSupportedProfile(forged)).toBe(false);
	});

	test('approval requires code-point fixtures, not just a reviewer name', () => {
		const noFixtures: LanguageProfile = {
			...MANDINKA_DRAFT_PROFILE,
			approval: {
				status: 'approved',
				reviewer: 'A. Reviewer',
				approvedAt: '2026-01-01',
				revision: 'r1',
			},
			fixtures: [],
		};

		expect(isSupportedProfile(noFixtures)).toBe(false);
		expect(
			validateLanguageProfile(noFixtures).issues.map((issue) => issue.field)
		).toContain('fixtures');
	});

	test('draft profiles record that provenance and licence are unresolved', () => {
		for (const profile of DRAFT_PROFILES) {
			expect(profile.provenance.source).toMatch(/UNCITED/);
			expect(profile.provenance.licence).toMatch(/UNKNOWN/);
			expect(profile.fonts.licence).toBeNull();
			expect(profile.keyman.keyboardId).toBeNull();
		}
	});
});
