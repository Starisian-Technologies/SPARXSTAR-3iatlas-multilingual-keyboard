/**
 * CI guard for specification section 4 and section 16 gate 10.
 *
 * Availability and linguistic validation are separate. A profile may ship as
 * available — selectable and typable — while AiWA review is outstanding. What
 * must never ship is a profile claiming AiWA validation without the evidence.
 *
 * This inspects the built, exported profile objects rather than source text,
 * so it cannot be defeated by reformatting.
 */

import {
	describeValidationStatus,
	isLinguisticallyValidated,
	validateLanguageProfile,
} from '../packages/core/dist/index.js';
import { ALL_PROFILES } from '../packages/profiles/dist/index.js';

if (!Array.isArray(ALL_PROFILES) || ALL_PROFILES.length === 0) {
	console.error(
		'Refusing to build: ALL_PROFILES is missing or empty, so this guard ' +
			'would pass vacuously. Build the packages before running it.'
	);
	process.exit(1);
}

const problems = [];

for (const profile of ALL_PROFILES) {
	const result = validateLanguageProfile(profile);

	if (!result.valid) {
		problems.push(
			`${profile.id}: structurally invalid — ` +
				result.issues.map((i) => `${i.field}: ${i.message}`).join('; ')
		);
	}

	// A profile may only be validated with a named reviewer and a date.
	if (isLinguisticallyValidated(profile)) {
		if (
			!profile.validation.reviewer ||
			!profile.validation.reviewedAt ||
			profile.fixtures.length === 0
		) {
			problems.push(
				`${profile.id}: claims AiWA validation without reviewer, date, or fixtures.`
			);
		}
	}

	// The disclosure string must never assert validation for an unvalidated
	// profile, since consumers render it verbatim.
	const disclosure = describeValidationStatus(profile);

	if (
		!isLinguisticallyValidated(profile) &&
		/linguistically validated by AiWA/.test(disclosure)
	) {
		problems.push(
			`${profile.id}: disclosure claims AiWA validation but the profile is not validated.`
		);
	}
}

if (problems.length > 0) {
	console.error('Refusing to build:\n' + problems.join('\n'));
	process.exit(1);
}

const validated = ALL_PROFILES.filter(isLinguisticallyValidated);

console.log(
	`OK: ${ALL_PROFILES.length} profile(s) checked. ` +
		`${validated.length} AiWA-validated, ` +
		`${ALL_PROFILES.length - validated.length} awaiting review. ` +
		'No false validation claims.'
);
