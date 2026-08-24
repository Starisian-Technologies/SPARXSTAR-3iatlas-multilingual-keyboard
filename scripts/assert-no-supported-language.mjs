/**
 * CI guard for specification section 4 and section 16 gate 10.
 *
 * Fails the build if any shipped profile is marked approved without the
 * evidence that approval requires. This is a deliberate tripwire: when a
 * reviewer genuinely approves a profile they must add the reviewer name,
 * approval date, and code-point fixtures in the same change, and then update
 * this script's expectation consciously rather than by accident.
 */

let draftProfiles;

try {
	({ DRAFT_PROFILES: draftProfiles } = await import(
		new URL('../packages/profiles/dist/index.js', import.meta.url).href
	));
} catch (error) {
	console.error(
		'Refusing to build: profiles package has not been built (expected packages/profiles/dist/index.js). ' +
			'Run `pnpm run build` before this guard.\n' +
			String(error)
	);
	process.exit(1);
}

if (!Array.isArray(draftProfiles)) {
	console.error(
		'Refusing to build: DRAFT_PROFILES did not export an array from packages/profiles.'
	);
	process.exit(1);
}

const approvedCount = draftProfiles.filter(
	(profile) => profile?.approval?.status === 'approved'
).length;

if (approvedCount > 0) {
	console.error(
		`Refusing to build: ${approvedCount} profile(s) claim approved status.\n` +
			'A profile may only be marked approved together with its reviewer, ' +
			'approval date, and code-point fixtures (see docs/PROFILE-REVIEW.md).'
	);
	process.exit(1);
}

console.log('OK: no profile claims supported status.');
