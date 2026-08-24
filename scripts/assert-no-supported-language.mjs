/**
 * CI guard for specification section 4 and section 16 gate 10.
 *
 * Fails the build if any shipped profile is marked approved without the
 * evidence that approval requires. This is a deliberate tripwire: when a
 * reviewer genuinely approves a profile they must add the reviewer name,
 * approval date, and code-point fixtures in the same change, and then update
 * this script's expectation consciously rather than by accident.
 */

import { readFileSync } from 'node:fs';

const source = readFileSync(
	new URL('../packages/profiles/src/index.ts', import.meta.url),
	'utf8'
);

const approvedCount = (source.match(/status: 'approved'/g) ?? []).length;

if (approvedCount > 0) {
	console.error(
		`Refusing to build: ${approvedCount} profile(s) claim approved status.\n` +
			'A profile may only be marked approved together with its reviewer, ' +
			'approval date, and code-point fixtures (see docs/PROFILE-REVIEW.md), ' +
			'and this guard must then be updated deliberately.'
	);
	process.exit(1);
}

console.log('OK: no profile claims supported status.');
