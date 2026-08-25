/**
 * Bundle size budgets and dependency isolation.
 *
 * Specification section 9 requires published size budgets per package and
 * requires a consumer to be able to ship Helper mode without pulling in React
 * or the Keyman engine. This script enforces both: it fails when a package
 * exceeds its gzipped budget, and when a Helper-path package reaches into
 * React or Keyman.
 */

import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

/** Gzipped ESM budgets in bytes. */
const BUDGETS = {
	core: 6_000,
	adapters: 3_000,
	profiles: 3_000,
	keyman: 3_000,
	react: 4_000,
	'multilingual-input': 1_000,
};

/** Packages a Helper-only consumer loads. None may pull React or Keyman. */
const HELPER_PATH = ['core', 'adapters', 'profiles'];
const FORBIDDEN_IN_HELPER_PATH = ['react', 'keyman'];

const problems = [];
const report = [];

for (const [name, budget] of Object.entries(BUDGETS)) {
	const path = `packages/${name}/dist/index.js`;
	let source;

	try {
		source = readFileSync(path);
	} catch {
		problems.push(`${name}: ${path} missing — build before checking budgets.`);
		continue;
	}

	const gzipped = gzipSync(source).length;

	report.push(
		`${name.padEnd(20)} ${String(source.length).padStart(7)} raw  ` +
			`${String(gzipped).padStart(6)} gz  (budget ${budget})`
	);

	if (gzipped > budget) {
		problems.push(
			`${name}: ${gzipped} bytes gzipped exceeds budget ${budget}.`
		);
	}

	// Dependency isolation for the Helper path.
	if (HELPER_PATH.includes(name)) {
		const text = source.toString('utf8');

		for (const forbidden of FORBIDDEN_IN_HELPER_PATH) {
			if (
				new RegExp(`from\\s*["'][^"']*multilingual-input-${forbidden}`).test(
					text
				) ||
				new RegExp(`require\\(["'][^"']*multilingual-input-${forbidden}`).test(
					text
				) ||
				new RegExp(`^\\s*import\\s+["']${forbidden}["']`, 'm').test(text)
			) {
				problems.push(
					`${name}: Helper-path package imports ${forbidden}, which a ` +
						'Helper-only consumer must not download (section 9).'
				);
			}
		}
	}
}

console.log('Bundle sizes (ESM):');
console.log(report.join('\n'));

if (problems.length > 0) {
	console.error('\nBudget/isolation failures:\n' + problems.join('\n'));
	process.exit(1);
}

console.log(
	'\nOK: all packages within budget; Helper path free of React and Keyman.'
);
