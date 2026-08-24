import { describe, expect, test } from '@jest/globals';

import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';
import {
	NullKeymanAdapter,
	checkKeymanEligibility,
} from '@starisian/3iatlas-multilingual-input-keyman';
import { MANDINKA_DRAFT_PROFILE } from '@starisian/3iatlas-multilingual-input-profiles';

describe('keyman eligibility', () => {
	test('refuses an unapproved profile before loading any asset', () => {
		expect(checkKeymanEligibility(MANDINKA_DRAFT_PROFILE)).toBe(
			'profile-not-approved'
		);
	});

	test('refuses an approved profile that has no pinned keyboard', () => {
		const approvedWithoutKeyboard: LanguageProfile = {
			...MANDINKA_DRAFT_PROFILE,
			approval: {
				status: 'approved',
				reviewer: 'A. Reviewer',
				approvedAt: '2026-01-01',
				revision: 'r1',
			},
		};

		expect(checkKeymanEligibility(approvedWithoutKeyboard)).toBe(
			'no-approved-keyboard'
		);
	});
});

describe('null keyman adapter', () => {
	test('reports unavailability instead of pretending to activate', async () => {
		const adapter = new NullKeymanAdapter();

		expect(adapter.isAvailable()).toBe(false);
		await expect(
			adapter.initialize({
				baseUrl: '/assets/keyman',
				pinnedEngineVersion: '0.0.0',
			})
		).resolves.toBe(false);

		// Failure must surface a reason so the consumer falls back to Helper.
		const activation = await adapter.activateProfile(MANDINKA_DRAFT_PROFILE);

		expect(activation.ok).toBe(false);
		await expect(adapter.teardown()).resolves.toBeUndefined();
	});
});
