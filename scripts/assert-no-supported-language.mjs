/**
 * CI guard for specification section 4 and section 16 gate 10.
 *
 * Fails the build if any shipped profile would be presented to users as a
 * supported language. This inspects the built, exported profile objects rather
 * than the source text, so it cannot be defeated by reformatting and cannot
 * false-positive on a comment.
 *
 * When a reviewer genuinely approves a profile, `isSupportedProfile` starts
 * returning true for it and this guard fails, forcing the approval to be an
 * explicit, reviewed change to this expectation rather than a silent one.
 */

import { isSupportedProfile } from '../packages/core/dist/index.js';
import { DRAFT_PROFILES } from '../packages/profiles/dist/index.js';

if (!Array.isArray(DRAFT_PROFILES) || DRAFT_PROFILES.length === 0) {
	console.error(
		'Refusing to build: DRAFT_PROFILES is missing or empty, so this guard ' +
			'would pass vacuously. Build the packages before running it.'
	);
	process.exit(1);
}

const supported = DRAFT_PROFILES.filter((profile) =>
	isSupportedProfile(profile)
);

if (supported.length > 0) {
	console.error(
		`Refusing to build: ${supported.length} profile(s) are exposed as ` +
			`supported: ${supported.map((p) => p.id).join(', ')}.\n` +
			'A profile may only reach supported status together with its ' +
			'reviewer, approval date, revision, and code-point fixtures ' +
			'(see docs/PROFILE-REVIEW.md), and this guard must then be updated ' +
			'deliberately.'
	);
	process.exit(1);
}

console.log(
	`OK: ${DRAFT_PROFILES.length} profile(s) checked, none claims supported status.`
);
