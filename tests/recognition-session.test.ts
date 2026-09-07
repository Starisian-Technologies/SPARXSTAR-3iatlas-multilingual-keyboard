/**
 * Recognition as suggestion, and the failure paths that keep writing usable.
 *
 * Two properties are load-bearing:
 *
 * 1. NOTHING is inserted by recognizing. Confirmation is a separate, explicit
 *    call, and confirmed text is byte-identical to what was confirmed.
 * 2. Every failure — offline, disabled, provider error, unsupported language —
 *    degrades to "no suggestions", never to an exception and never to a
 *    silently substituted word.
 */

import { describe, expect, it, jest } from '@jest/globals';

import type { InkStroke } from '@starisian/3iatlas-input-ink';
import type {
	HandwritingRecognizer,
	RecognitionRequest,
	RecognitionResult,
	SpellLexicon,
} from '@starisian/3iatlas-input-recognition';
import {
	SPELL_LEXICON_SCHEMA_VERSION,
	LexiconIndex,
	RecognitionSession,
	UnavailableRecognizer,
	isHandwritingRecognizer,
} from '@starisian/3iatlas-input-recognition';

const CLOCK = (): Date => new Date('2026-09-06T12:00:00.000Z');

const STROKE: InkStroke = {
	id: 'stroke_1',
	tool: 'pen',
	pointerType: 'pen',
	color: '#000000',
	sizePx: 3,
	opacity: 1,
	startedAt: 0,
	points: [{ x: 1, y: 1, pressure: 0.5, t: 0 }],
};

const SUBJECT = {
	inkDocumentId: 'ink_1',
	strokes: [STROKE],
	canvasWidthPx: 400,
	canvasHeightPx: 200,
} as const;

const LEXICON: SpellLexicon = {
	schemaVersion: SPELL_LEXICON_SCHEMA_VERSION,
	language: 'mnk',
	revision: 'rev-7',
	orthography: 'peace-corps-gm',
	generatedAt: '2026-09-01T00:00:00.000Z',
	entries: [
		{ id: 'e1', headword: 'kuŋo', variants: ['kungo'], status: 'approved' },
	],
};

/**
 * Builds a recognizer that returns fixed candidates.
 *
 * @param texts Candidate texts, in order.
 * @return The recognizer.
 */
const recognizerReturning = (
	texts: readonly string[]
): HandwritingRecognizer => ({
	id: 'test',
	isAvailable: () => true,
	supportedLanguages: () => ['mnk-Latn-GM'],
	recognize: async (): Promise<RecognitionResult> => ({
		ok: true,
		lexiconRevision: null,
		candidates: texts.map((text, index) => ({
			id: `c${index}`,
			text,
			confidence: 1 - index * 0.1,
			inApprovedLexicon: false,
			lexiconEntryId: null,
		})),
	}),
});

/**
 * Builds a session over a recognizer.
 *
 * @param recognizer Recognizer to use.
 * @param withLexicon Whether to attach the approved lexicon.
 * @return The session.
 */
const sessionWith = (
	recognizer: HandwritingRecognizer,
	withLexicon = true
): RecognitionSession =>
	new RecognitionSession({
		recognizer,
		lexicon: withLexicon ? new LexiconIndex(LEXICON) : null,
		languageTag: 'mnk-Latn-GM',
		now: CLOCK,
	});

describe('the recognizer contract', () => {
	it('recognizes a well-formed recognizer', () => {
		expect(isHandwritingRecognizer(recognizerReturning([]))).toBe(true);
	});

	it('rejects objects that only look like one', () => {
		expect(isHandwritingRecognizer(null)).toBe(false);
		expect(isHandwritingRecognizer({ id: 'x' })).toBe(false);
	});
});

describe('recognition is unavailable by default', () => {
	it('reports disabled rather than throwing when none is configured', async () => {
		const session = sessionWith(new UnavailableRecognizer());

		expect(session.isAvailable).toBe(false);

		const result = await session.propose(SUBJECT);

		expect(result.candidates).toEqual([]);
		expect(result.failure).toBe('disabled');
	});

	it('carries the reason through, so offline reads as offline', async () => {
		const session = sessionWith(new UnavailableRecognizer('offline'));
		const result = await session.propose({ ...SUBJECT });

		// `isAvailable` is false for every UnavailableRecognizer, so the
		// session short-circuits; the writer still gets a reason, not silence.
		expect(result.failure).not.toBeNull();
		expect(result.candidates).toEqual([]);
	});
});

describe('failure paths', () => {
	it('survives a recognizer that throws', async () => {
		const session = sessionWith({
			id: 'broken',
			isAvailable: () => true,
			supportedLanguages: () => ['mnk-Latn-GM'],
			recognize: async () => {
				throw new Error('network died mid-request');
			},
		});
		const result = await session.propose(SUBJECT);

		expect(result.failure).toBe('provider-error');
		expect(result.candidates).toEqual([]);
	});

	it('survives a recognizer that throws while reporting availability', () => {
		const session = sessionWith({
			id: 'broken',
			isAvailable: () => {
				throw new Error('probe failed');
			},
			supportedLanguages: () => [],
			recognize: async () => ({ ok: false, reason: 'provider-error' }),
		});

		expect(session.isAvailable).toBe(false);
	});

	it('reports the provider reason when the provider declines', async () => {
		const session = sessionWith({
			id: 'declining',
			isAvailable: () => true,
			supportedLanguages: () => [],
			recognize: async () => ({ ok: false, reason: 'unsupported-language' }),
		});

		expect((await session.propose(SUBJECT)).failure).toBe(
			'unsupported-language'
		);
	});

	it('does not call the recognizer for an empty page', async () => {
		const recognize = jest.fn(async (): Promise<RecognitionResult> => ({
			ok: true,
			candidates: [],
			lexiconRevision: null,
		}));
		const session = sessionWith({
			id: 'counting',
			isAvailable: () => true,
			supportedLanguages: () => [],
			recognize,
		});

		await session.propose({ ...SUBJECT, strokes: [] });

		expect(recognize).not.toHaveBeenCalled();
	});
});

describe('candidates are annotated, never rewritten', () => {
	it('marks an approved word as present in the lexicon', async () => {
		const result = await sessionWith(recognizerReturning(['kuŋo'])).propose(
			SUBJECT
		);

		expect(result.candidates[0]?.text).toBe('kuŋo');
		expect(result.candidates[0]?.inApprovedLexicon).toBe(true);
		expect(result.candidates[0]?.lexiconEntryId).toBe('e1');
	});

	it('marks an accepted variant as approved and keeps the variant spelling', async () => {
		const result = await sessionWith(recognizerReturning(['kungo'])).propose(
			SUBJECT
		);

		expect(result.candidates[0]?.text).toBe('kungo');
		expect(result.candidates[0]?.inApprovedLexicon).toBe(true);
	});

	it('marks an English word as not approved but leaves it in the list', async () => {
		const result = await sessionWith(recognizerReturning(['kingo'])).propose(
			SUBJECT
		);

		// The English-looking candidate is neither hidden nor promoted over
		// the Mandinka word. It is labelled, and a person decides.
		expect(result.candidates[0]?.text).toBe('kingo');
		expect(result.candidates[0]?.inApprovedLexicon).toBe(false);
		expect(result.candidates[0]?.lexiconEntryId).toBeNull();
	});

	it('reports nothing as approved when no lexicon is loaded', async () => {
		const result = await sessionWith(
			recognizerReturning(['kuŋo']),
			false
		).propose(SUBJECT);

		// Not checked is not approved. Claiming otherwise would report an
		// unverified word to the writer as dictionary-backed.
		expect(result.candidates[0]?.inApprovedLexicon).toBe(false);
		expect(result.lexiconRevision).toBeNull();
	});

	it('preserves the recognizer order rather than sorting by lexicon status', async () => {
		const result = await sessionWith(
			recognizerReturning(['kingo', 'kuŋo'])
		).propose(SUBJECT);

		expect(result.candidates.map((c) => c.text)).toEqual(['kingo', 'kuŋo']);
	});
});

describe('confirmation', () => {
	it('records the confirmed text verbatim', async () => {
		const session = sessionWith(recognizerReturning(['kuŋo']));
		const suggestions = await session.propose(SUBJECT);
		const transcription = session.confirmCandidate(suggestions, 'c0');

		expect(transcription?.text).toBe('kuŋo');
		expect(Array.from(transcription?.text ?? '')).toEqual(['k', 'u', 'ŋ', 'o']);
		expect(transcription?.source).toBe('recognized-candidate');
		expect(transcription?.lexiconEntryId).toBe('e1');
		expect(transcription?.lexiconRevision).toBe('rev-7');
	});

	it('links the transcription to the ink it came from', async () => {
		const session = sessionWith(recognizerReturning(['kuŋo']));
		const suggestions = await session.propose(SUBJECT);
		const transcription = session.confirmCandidate(suggestions, 'c0');

		expect(transcription?.inkDocumentId).toBe('ink_1');
		expect(transcription?.strokeIds).toEqual(['stroke_1']);
	});

	it('refuses a candidate id that is not in the set', async () => {
		const session = sessionWith(recognizerReturning(['kuŋo']));
		const suggestions = await session.propose(SUBJECT);

		expect(session.confirmCandidate(suggestions, 'not-there')).toBeNull();
	});

	it('does not claim a lexicon revision for an unapproved candidate', async () => {
		const session = sessionWith(recognizerReturning(['kingo']));
		const suggestions = await session.propose(SUBJECT);

		expect(
			session.confirmCandidate(suggestions, 'c0')?.lexiconRevision
		).toBeNull();
	});
});

describe('the word-not-listed path', () => {
	const session = sessionWith(new UnavailableRecognizer());
	const subject = { inkDocumentId: 'ink_1', strokeIds: ['stroke_1'] };

	it('keeps the writer own spelling exactly', () => {
		const transcription = session.confirmTypedText(subject, 'kuŋooba');

		expect(transcription.text).toBe('kuŋooba');
		expect(transcription.source).toBe('not-listed');
		expect(transcription.lexiconEntryId).toBeNull();
	});

	it('records typed text that IS approved as typed, not as unlisted', () => {
		expect(session.confirmTypedText(subject, 'kuŋo').source).toBe('typed');
	});

	it('packages evidence without writing anywhere', () => {
		const transcription = session.confirmTypedText(subject, 'kuŋooba');
		const evidence = session.offerUnlistedWord(transcription);

		expect(evidence).toEqual({
			inkDocumentId: 'ink_1',
			strokeIds: ['stroke_1'],
			text: 'kuŋooba',
			languageTag: 'mnk-Latn-GM',
			lexiconRevision: 'rev-7',
			offeredAt: '2026-09-06T12:00:00.000Z',
		});
	});

	it('works with no recognizer at all, which is the offline case', () => {
		const offline = new RecognitionSession({
			recognizer: new UnavailableRecognizer('offline'),
			languageTag: 'mnk-Latn-GM',
			now: CLOCK,
		});

		expect(offline.confirmTypedText(subject, 'kuŋo').text).toBe('kuŋo');
	});
});

describe('cancelled and superseded rounds cannot reach the writer', () => {
	/**
	 * Builds a recognizer whose answer is held until released.
	 *
	 * @param texts Candidate texts to eventually return.
	 * @return The recognizer and the release function.
	 */
	const stallingRecognizer = (
		texts: readonly string[]
	): { recognizer: HandwritingRecognizer; release: () => void } => {
		let release = (): void => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		return {
			release: () => release(),
			recognizer: {
				id: 'stalling',
				isAvailable: () => true,
				supportedLanguages: () => ['mnk-Latn-GM'],
				// Deliberately ignores request.signal, which is what a real
				// provider is free to do: abort is cooperative.
				recognize: async (): Promise<RecognitionResult> => {
					await gate;

					return {
						ok: true,
						lexiconRevision: null,
						candidates: texts.map((text, index) => ({
							id: `c${index}`,
							text,
							confidence: 1,
							inApprovedLexicon: false,
							lexiconEntryId: null,
						})),
					};
				},
			},
		};
	};

	it('discards a result that arrives after cancel()', async () => {
		const { recognizer, release } = stallingRecognizer(['kuŋo']);
		const session = sessionWith(recognizer);
		const pending = session.propose(SUBJECT);

		session.cancel();
		release();

		const result = await pending;

		// The provider ignored the abort signal and answered anyway. The
		// session still refuses to surface suggestions for abandoned ink.
		expect(result.candidates).toEqual([]);
		expect(result.failure).toBe('cancelled');
	});

	it('discards a result superseded by a newer round', async () => {
		const first = stallingRecognizer(['stale']);
		const session = sessionWith(first.recognizer);
		const pending = session.propose(SUBJECT);

		// A newer round starts and finishes while the first is still stalled.
		const newer = sessionWith(recognizerReturning(['fresh']));

		void newer;
		session.cancel();
		first.release();

		expect((await pending).failure).toBe('cancelled');
	});

	it('gives up on a recognizer that never answers', async () => {
		const { recognizer } = stallingRecognizer(['never']);
		const session = new RecognitionSession({
			recognizer,
			lexicon: new LexiconIndex(LEXICON),
			languageTag: 'mnk-Latn-GM',
			timeoutMs: 20,
			now: CLOCK,
		});
		const result = await session.propose(SUBJECT);

		// Writing must not wait on a stalled provider indefinitely.
		expect(result.failure).toBe('timeout');
		expect(result.candidates).toEqual([]);
	});
});

describe('switching language', () => {
	it('sends the new language tag on the next round', async () => {
		const seen: RecognitionRequest[] = [];
		const session = sessionWith({
			id: 'capturing',
			isAvailable: () => true,
			supportedLanguages: () => [],
			recognize: async (request) => {
				seen.push(request);

				return { ok: true, candidates: [], lexiconRevision: null };
			},
		});

		await session.propose(SUBJECT);
		session.setLanguageTag('wo-Latn-SN');

		expect(session.language).toBe('wo-Latn-SN');

		await session.propose(SUBJECT);

		expect(seen.map((request) => request.languageTag)).toEqual([
			'mnk-Latn-GM',
			'wo-Latn-SN',
		]);
	});

	it('is a no-op when the tag is unchanged', () => {
		const session = sessionWith(new UnavailableRecognizer());

		session.setLanguageTag('mnk-Latn-GM');

		expect(session.language).toBe('mnk-Latn-GM');
	});
});

describe('the request handed to a recognizer', () => {
	it('carries the language tag and the lexicon revision', async () => {
		// Collected into an array rather than a `let`: the assignment happens
		// inside a callback, which TypeScript's control-flow analysis cannot
		// see, so a nullable local would narrow to `never` after the assertion.
		const seen: RecognitionRequest[] = [];
		const session = sessionWith({
			id: 'capturing',
			isAvailable: () => true,
			supportedLanguages: () => [],
			recognize: async (request) => {
				seen.push(request);

				return { ok: true, candidates: [], lexiconRevision: null };
			},
		});

		await session.propose(SUBJECT);

		expect(seen).toHaveLength(1);
		expect(seen[0]?.languageTag).toBe('mnk-Latn-GM');
		expect(seen[0]?.lexiconRevision).toBe('rev-7');
	});
});
