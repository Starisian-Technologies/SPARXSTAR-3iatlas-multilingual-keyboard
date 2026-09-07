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
 * file a person has to edit. This is a TEXT scan, which is a deliberate
 * trade: it is cheap and has no dependencies, and its limits are the reason
 * the checks below cover indirect access and declared dependencies rather
 * than only the obvious spelling of `fetch(`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Network primitives no package source may reference.
 *
 * Covers indirect access as well as the bare identifier: `globalThis['fetch']`
 * and `window.fetch` reach the network just as effectively as `fetch(`, and a
 * guard matching only the plain call would pass a package that ships either.
 */
const FORBIDDEN = [
	{ pattern: /\bfetch\s*\(/, name: 'fetch()' },
	{
		pattern:
			/\[\s*(['"`])(?:fetch|XMLHttpRequest|WebSocket|EventSource)\1\s*\]/,
		name: 'computed access to a network global',
	},
	{
		pattern: /\b(?:globalThis|window|self)\s*\.\s*fetch\b/,
		name: 'qualified access to fetch',
	},
	{ pattern: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
	{ pattern: /\bWebSocket\b/, name: 'WebSocket' },
	{ pattern: /\bEventSource\b/, name: 'EventSource' },
	{ pattern: /\bsendBeacon\b/, name: 'navigator.sendBeacon' },
	{ pattern: /\bimportScripts\s*\(/, name: 'importScripts()' },
	{
		pattern: /\bnavigator\s*\.\s*serviceWorker\b/,
		name: 'navigator.serviceWorker',
	},
	{
		pattern: /\bfrom\s*['"](?:node:)?(?:http|https|http2|net|tls|dgram)['"]/,
		name: 'a Node network module import',
	},
	{
		pattern:
			/\brequire\s*\(\s*['"](?:node:)?(?:http|https|http2|net|tls|dgram)['"]/,
		name: 'a Node network module require',
	},
];

/**
 * HTTP client packages a package may neither import nor declare.
 *
 * Checked on the specifier and on `package.json` rather than on a call site: a
 * package that merely DEPENDS on one has already shipped the ability to make a
 * request, whether or not today's source calls it.
 */
const HTTP_CLIENTS = [
	'axios',
	'node-fetch',
	'cross-fetch',
	'isomorphic-fetch',
	'got',
	'undici',
	'ky',
	'superagent',
	'request',
	'needle',
	'phin',
	'wretch',
	'@microsoft/fetch-event-source',
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
 * Escapes a string for use inside a regular expression.
 *
 * @param value Text to escape.
 * @return The escaped text.
 */
const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lists every source file under a directory.
 *
 * JavaScript is included as well as TypeScript: a `.js` or `.mjs` file under
 * `src` ships exactly like a `.ts` one, so scanning only TypeScript would
 * leave the simplest bypass wide open.
 *
 * @param directory Directory to walk.
 * @return Paths of the source files found.
 */
const sourcesIn = (directory) => {
	const found = [];

	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);

		if (statSync(path).isDirectory()) {
			found.push(...sourcesIn(path));
			continue;
		}

		if (/\.(?:tsx?|mts|cts|jsx?|mjs|cjs)$/.test(entry)) {
			found.push(path);
		}
	}

	return found;
};

for (const pkg of readdirSync('packages')) {
	// A declared dependency is as good as an import.
	try {
		const manifest = JSON.parse(
			readFileSync(join('packages', pkg, 'package.json'), 'utf8')
		);
		const declared = Object.keys({
			...(manifest.dependencies ?? {}),
			...(manifest.peerDependencies ?? {}),
		});

		for (const name of declared) {
			if (HTTP_CLIENTS.includes(name)) {
				problems.push(
					`${pkg}: declares a dependency on the HTTP client "${name}". ` +
						'No package here may talk to the network.'
				);
			}
		}
	} catch {
		problems.push(`${pkg}: package.json is missing or unreadable.`);
	}

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

		for (const client of HTTP_CLIENTS) {
			const specifier = escapeForRegExp(client);

			if (
				new RegExp(`from\\s*["']${specifier}(?:/[^"']*)?["']`).test(text) ||
				new RegExp(`require\\(\\s*["']${specifier}(?:/[^"']*)?["']`).test(text)
			) {
				problems.push(
					`${file}: imports the HTTP client "${client}". Transport is ` +
						'supplied by the consuming product, not by this package.'
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
	'OK: no package source or dependency reaches the network, and none binds ' +
		'a credential.'
);
