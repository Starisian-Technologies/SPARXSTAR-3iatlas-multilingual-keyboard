/**
 * Lexicon handling and Unicode preservation.
 *
 * These are the governance tests. A failure here is not a bug in a feature —
 * it is the toolkit changing a Mandinka word, which is the single thing it
 * must never do.
 *
 * The Mandinka forms used below are the ones the shipped profile already
 * carries: `ŋ` (U+014B), `ñ` (U+00F1), and length written by vowel doubling.
 * They are used as UNICODE FIXTURES, not as a claim about the lexicon's
 * contents — the approved word list comes from the Dictionary, never from a
 * test file.
 */

import { describe, expect, it } from '@jest/globals';

import type { SpellLexicon } from '@starisian/3iatlas-input-recognition';
import {
	SPELL_LEXICON_SCHEMA_VERSION,
	LexiconIndex,
	isNfc,
	parseSpellLexicon,
} from '@starisian/3iatlas-input-recognition';

/**
 * Builds a lexicon payload.
 *
 * @param entries Entries to include.
 * @return The payload.
 */
const lexicon = (entries: SpellLexicon['entries']): SpellLexicon => ({
	schemaVersion: SPELL_LEXICON_SCHEMA_VERSION,
	language: 'mnk',
	revision: 'rev-1',
	orthography: 'peace-corps-gm',
	generatedAt: '2026-09-01T00:00:00.000Z',
	entries,
});

/**
 * `ñ` written as base + combining tilde, i.e. NFD rather than NFC.
 *
 * Written as escapes rather than as a literal character on purpose: an editor,
 * a clipboard, or a tool in the pipeline can silently normalize a pasted
 * decomposed sequence, after which every assertion below would pass while
 * asserting nothing at all.
 */
const DECOMPOSED_N_TILDE = '\u006E\u0303';

describe('lexicon validation', () => {
	it('accepts a well-formed lexicon', () => {
		const parsed = parseSpellLexicon(
			JSON.stringify(
				lexicon([
					{
						id: 'e1',
						headword: 'kuŋo',
						variants: ['kungo'],
						status: 'approved',
					},
				])
			)
		);

		expect(parsed.ok).toBe(true);
	});

	it('refuses an unknown schema version rather than reading it optimistically', () => {
		const parsed = parseSpellLexicon({
			...lexicon([]),
			schemaVersion: SPELL_LEXICON_SCHEMA_VERSION + 1,
		});

		expect(parsed.ok).toBe(false);

		if (parsed.ok) {
			return;
		}

		expect(parsed.issues[0]?.path).toBe('schemaVersion');
	});

	it('refuses a decomposed headword instead of normalizing it', () => {
		const parsed = parseSpellLexicon(
			lexicon([
				{
					id: 'e1',
					headword: `ba${DECOMPOSED_N_TILDE}o`,
					variants: [],
					status: 'approved',
				},
			])
		);

		expect(parsed.ok).toBe(false);

		if (parsed.ok) {
			return;
		}

		// The point is the REFUSAL. Quietly normalizing published language
		// data here would hide a publishing fault and change letters.
		expect(parsed.issues.some((issue) => issue.message.includes('NFC'))).toBe(
			true
		);
	});

	it('refuses a decomposed variant too', () => {
		const parsed = parseSpellLexicon(
			lexicon([
				{
					id: 'e1',
					headword: 'baño',
					variants: [`ba${DECOMPOSED_N_TILDE}o`],
					status: 'approved',
				},
			])
		);

		expect(parsed.ok).toBe(false);
	});

	it('refuses duplicate entry identifiers', () => {
		const parsed = parseSpellLexicon(
			lexicon([
				{ id: 'e1', headword: 'kuŋo', variants: [], status: 'approved' },
				{ id: 'e1', headword: 'baa', variants: [], status: 'approved' },
			])
		);

		expect(parsed.ok).toBe(false);
	});

	it('refuses an unknown entry status', () => {
		const parsed = parseSpellLexicon({
			...lexicon([]),
			entries: [
				{ id: 'e1', headword: 'kuŋo', variants: [], status: 'pending-review' },
			],
		});

		expect(parsed.ok).toBe(false);
	});

	it('refuses text that is not JSON', () => {
		expect(parseSpellLexicon('<html>').ok).toBe(false);
	});

	it('accepts an empty lexicon, which is a legitimate publication state', () => {
		const parsed = parseSpellLexicon(lexicon([]));

		expect(parsed.ok).toBe(true);
	});
});

describe('NFC detection', () => {
	it('accepts precomposed Mandinka letters', () => {
		expect(isNfc('ŋ')).toBe(true);
		expect(isNfc('ñ')).toBe(true);
		expect(isNfc('Ŋ')).toBe(true);
	});

	it('rejects a decomposed sequence', () => {
		expect(isNfc(DECOMPOSED_N_TILDE)).toBe(false);
	});
});

describe('lexicon lookup', () => {
	const index = new LexiconIndex(
		lexicon([
			{
				id: 'e1',
				headword: 'kuŋo',
				variants: ['kungo', 'kuŋoo'],
				status: 'approved',
			},
			{ id: 'e2', headword: 'baa', variants: [], status: 'approved' },
			{ id: 'e3', headword: 'retired', variants: [], status: 'withdrawn' },
		])
	);

	it('finds a headword', () => {
		expect(index.lookup('kuŋo')?.entryId).toBe('e1');
		expect(index.lookup('kuŋo')?.isHeadword).toBe(true);
	});

	it('finds an accepted variant and reports the variant, not the headword', () => {
		const match = index.lookup('kungo');

		expect(match?.entryId).toBe('e1');
		expect(match?.isHeadword).toBe(false);
		// The matched form is the writer's accepted spelling. Returning the
		// headword here is how a regional spelling gets silently replaced.
		expect(match?.matchedForm).toBe('kungo');
	});

	it('does not match a decomposed spelling of an approved word', () => {
		// Exact code points only. Two forms that look identical but differ in
		// code points are different strings, and conflating them is the first
		// step toward rewriting one as the other.
		expect(index.lookup(`ku${DECOMPOSED_N_TILDE}o`)).toBeNull();
	});

	it('does not match on case', () => {
		expect(index.lookup('KUŊO')).toBeNull();
	});

	it('does not match a shortened long vowel', () => {
		expect(index.lookup('ba')).toBeNull();
		expect(index.lookup('baa')?.entryId).toBe('e2');
	});

	it('never returns a withdrawn entry', () => {
		expect(index.lookup('retired')).toBeNull();
	});

	it('counts headwords and variants together, withdrawals excluded', () => {
		expect(index.size).toBe(4);
	});
});
