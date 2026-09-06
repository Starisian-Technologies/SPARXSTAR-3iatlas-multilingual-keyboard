/**
 * CI guard: no package in this repository may talk to the network.
 *
 * This is the invariant the whole recognition design rests on. The toolkit
 * defines a provider-neutral port and lets the consuming product supply the
 * transport, which is what keeps a recognition credential out of every browser
 * bundle that embeds this package. A single `fetch` added here would quietly
 * undo that, and nothing else in the pipeline would notice.
 *
 * Specification section 10 backs it: input processing is local, and this
 * package transmits no keystrokes, composed words, or document fragments.
 *
 * Source is scanned rather than the build output, so the failure names the
 * file a person has to edit.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Network primitives no package source may reference. */
const FORBIDDEN = [
	{ pattern: /\bfetch\s*\(/, name: 'fetch()' },
	{ pattern: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
	{ pattern: /\bWebSocket\b/, name: 'WebSocket' },
	{ pattern: /\bEventSource\b/, name: 'EventSource' },
	{ pattern: /\bsendBeacon\b/, name: 'navigator.sendBeacon' },
	{ pattern: /\bimportScripts\s*\(/, name: 'importScripts()' },
	{
		pattern: /\bnavigator\s*\.\s*serviceWorker\b/,
		name: 'navigator.serviceWorker',
	},
];

/**
 * Credential-shaped assignments. A mention in prose is fine — several files
 * exist precisely to say these must never appear — so only code that binds one
 * to a name is flagged.
 */
const CREDENTIAL_BINDING =
	/(?:const|let|var)\s+\w*(?:apiKey|hmacKey|applicationKey|secret|bearer|accessToken)\w*\s*=/i;

/** Comment forms stripped before scanning, so documentation never fails CI. */
const COMMENTS = [/\/\*[\s\S]*?\*\//g, /(^|[^:])\/\/.*$/gm];

const problems = [];

/**
 * Lists every source file under a directory.
 *
 * @param directory Directory to walk.
 * @return Absolute-ish paths of TypeScript sources.
 */
const sourcesIn = (directory) => {
	const found = [];

	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);

		if (statSync(path).isDirectory()) {
			found.push(...sourcesIn(path));
			continue;
		}

		if (/\.tsx?$/.test(entry)) {
			found.push(path);
		}
	}

	return found;
};

for (const pkg of readdirSync('packages')) {
	const source = join('packages', pkg, 'src');

	let files;

	try {
		files = sourcesIn(source);
	} catch {
		problems.push(`${pkg}: no src directory to scan.`);
		continue;
	}

	for (const file of files) {
		let text = readFileSync(file, 'utf8');

		for (const comment of COMMENTS) {
			text = text.replace(comment, '$1');
		}

		for (const { pattern, name } of FORBIDDEN) {
			if (pattern.test(text)) {
				problems.push(
					`${file}: references ${name}. No package here may talk to the ` +
						'network — recognition and lexicon transport are supplied by ' +
						'the consuming product (section 10, TOOLKIT-ADR-001).'
				);
			}
		}

		if (CREDENTIAL_BINDING.test(text)) {
			problems.push(
				`${file}: binds a credential-shaped value. This package holds no ` +
					'credentials; a recognition provider key belongs in the ' +
					"consuming product's server-side environment."
			);
		}
	}
}

if (problems.length > 0) {
	console.error(
		'Network/credential isolation failures:\n' + problems.join('\n')
	);
	process.exit(1);
}

console.log(
	'OK: no package source references a network primitive or binds a credential.'
);
