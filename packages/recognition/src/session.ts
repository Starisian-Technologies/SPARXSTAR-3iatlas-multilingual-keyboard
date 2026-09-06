/**
 * Recognition as SUGGESTION, never as substitution.
 *
 * Three rules are enforced by the shape of this API rather than by discipline,
 * because discipline is what fails under a deadline:
 *
 * 1. Nothing is ever inserted by recognizing. {@link RecognitionSession.propose}
 *    returns suggestions and has no way to write text anywhere. Text reaches an
 *    editor only through {@link RecognitionSession.confirm}, which a person's
 *    action must call.
 * 2. Confirmed text is the exact text confirmed. No normalization, no case
 *    change, no diacritic stripping, no vowel shortening, no digraph splitting
 *    happens anywhere on this path.
 * 3. A word the approved lexicon does not carry is marked as such and still
 *    confirmable. "Not in the lexicon" is never rendered as "wrong", and the
 *    writer's own spelling is never quietly swapped for an approved one.
 *
 * The session writes to no dictionary. Evidence for an unlisted word is handed
 * to the consuming product, which owns the review workflow; this package does
 * not know that workflow exists.
 */

import type { InkStroke } from '@starisian/3iatlas-input-ink';
import { createInkTranscription } from '@starisian/3iatlas-input-ink';
import type { InkTranscription } from '@starisian/3iatlas-input-ink';

import type { LexiconIndex } from './lexicon';
import type {
	HandwritingRecognizer,
	RecognitionCandidate,
	RecognitionFailureReason,
	RecognitionRequest,
	RecognitionResult,
} from './port';

/** What the writer is shown after a recognition round. */
export interface SuggestionSet {
	/** The ink these suggestions are about. */
	readonly inkDocumentId: string;
	readonly strokeIds: readonly string[];
	/** Proposed readings, in the recognizer's own order. May be empty. */
	readonly candidates: readonly RecognitionCandidate[];
	/** Why there are no candidates, when recognition could not run. */
	readonly failure: RecognitionFailureReason | null;
	/** Lexicon revision the candidates were checked against, when any. */
	readonly lexiconRevision: string | null;
}

/** Everything a session needs. */
export interface RecognitionSessionOptions {
	readonly recognizer: HandwritingRecognizer;
	/**
	 * Approved lexicon to check candidates against.
	 *
	 * Optional: with no lexicon, every candidate is reported as not present in
	 * the approved lexicon, which is the honest answer when nothing was
	 * checked. It is never reported as approved by default.
	 */
	readonly lexicon?: LexiconIndex | null;
	/** BCP 47 tag of the writer's selected language. */
	readonly languageTag: string;
	/** Injected clock, so tests are deterministic. */
	readonly now?: () => Date;
}

/** Ink handed to a recognition round. */
export interface RecognitionSubject {
	readonly inkDocumentId: string;
	readonly strokes: readonly InkStroke[];
	readonly canvasWidthPx: number;
	readonly canvasHeightPx: number;
}

/**
 * Evidence for a word the approved lexicon does not carry.
 *
 * This is NOT a dictionary write and must never be treated as one. It is a
 * package of what the writer wrote and what they say it says, handed to the
 * consuming product to route into whatever review process governs new words.
 * Approval is a linguistic authority's decision, taken elsewhere.
 */
export interface UnlistedWordEvidence {
	readonly inkDocumentId: string;
	readonly strokeIds: readonly string[];
	/** The spelling the writer confirmed, verbatim. */
	readonly text: string;
	readonly languageTag: string;
	/** Lexicon revision that was checked and did not carry it. */
	readonly lexiconRevision: string | null;
	/** ISO 8601 time the writer offered it. */
	readonly offeredAt: string;
}

/**
 * Annotates a candidate with its approved-lexicon status.
 *
 * @param candidate Candidate from the recognizer.
 * @param lexicon   Lexicon to check against, or null.
 * @return The annotated candidate.
 */
const annotate = (
	candidate: RecognitionCandidate,
	lexicon: LexiconIndex | null
): RecognitionCandidate => {
	const match = lexicon?.lookup(candidate.text) ?? null;

	return {
		...candidate,
		// The text is copied through untouched. Only the annotation changes.
		inApprovedLexicon: match !== null,
		lexiconEntryId: match?.entryId ?? null,
	};
};

/** Drives one writer's recognition and confirmation flow. */
export class RecognitionSession {
	private readonly recognizer: HandwritingRecognizer;

	private readonly lexicon: LexiconIndex | null;

	private readonly languageTag: string;

	private readonly now: () => Date;

	private pending: AbortController | null = null;

	/**
	 * @param options Session configuration.
	 */
	public constructor(options: RecognitionSessionOptions) {
		this.recognizer = options.recognizer;
		this.lexicon = options.lexicon ?? null;
		this.languageTag = options.languageTag;
		this.now = options.now ?? (() => new Date());
	}

	/** Whether a recognition round can be attempted right now. */
	public get isAvailable(): boolean {
		try {
			return this.recognizer.isAvailable();
		} catch {
			// A consumer-supplied recognizer that throws while being asked
			// whether it works has answered the question.
			return false;
		}
	}

	/** The lexicon revision in force, or null when none is loaded. */
	public get lexiconRevision(): string | null {
		return this.lexicon?.revision ?? null;
	}

	/**
	 * Asks the recognizer for readings of some ink.
	 *
	 * Cancels any round still in flight: the writer has moved on, and a late
	 * result would replace the suggestions they are currently looking at.
	 *
	 * @param subject Ink to read.
	 * @return The suggestions, or the reason there are none.
	 */
	public async propose(subject: RecognitionSubject): Promise<SuggestionSet> {
		const strokeIds = subject.strokes.map((stroke) => stroke.id);
		const empty = (failure: RecognitionFailureReason): SuggestionSet => ({
			inkDocumentId: subject.inkDocumentId,
			strokeIds,
			candidates: [],
			failure,
			lexiconRevision: this.lexiconRevision,
		});

		if (subject.strokes.length === 0) {
			return empty('cancelled');
		}

		if (!this.isAvailable) {
			return empty('disabled');
		}

		this.pending?.abort();

		const controller =
			typeof AbortController === 'function' ? new AbortController() : null;

		this.pending = controller;

		const request: RecognitionRequest = {
			inkDocumentId: subject.inkDocumentId,
			strokes: subject.strokes,
			canvasWidthPx: subject.canvasWidthPx,
			canvasHeightPx: subject.canvasHeightPx,
			languageTag: this.languageTag,
			lexiconRevision: this.lexiconRevision,
			...(controller === null ? {} : { signal: controller.signal }),
		};

		let result: RecognitionResult;

		try {
			result = await this.recognizer.recognize(request);
		} catch {
			// A recognizer that throws is a recognizer that failed. It must
			// not take the writer's page down with it.
			return empty('provider-error');
		} finally {
			if (this.pending === controller) {
				this.pending = null;
			}
		}

		if (!result.ok) {
			return empty(result.reason);
		}

		return {
			inkDocumentId: subject.inkDocumentId,
			strokeIds,
			candidates: result.candidates.map((candidate) =>
				annotate(candidate, this.lexicon)
			),
			failure: null,
			lexiconRevision: this.lexiconRevision,
		};
	}

	/** Abandons any round in flight. */
	public cancel(): void {
		this.pending?.abort();
		this.pending = null;
	}

	/**
	 * Records a writer's confirmation of a suggested reading.
	 *
	 * @param suggestions The set the writer was looking at.
	 * @param candidateId The suggestion they chose.
	 * @return The transcription record, or null when the id is not in the set.
	 */
	public confirmCandidate(
		suggestions: SuggestionSet,
		candidateId: string
	): InkTranscription | null {
		const candidate = suggestions.candidates.find(
			(entry) => entry.id === candidateId
		);

		if (candidate === undefined) {
			return null;
		}

		return createInkTranscription(
			{
				inkDocumentId: suggestions.inkDocumentId,
				strokeIds: suggestions.strokeIds,
				// Verbatim. This is the one line that matters most in the file.
				text: candidate.text,
				source: 'recognized-candidate',
				lexiconEntryId: candidate.lexiconEntryId,
				lexiconRevision: candidate.inApprovedLexicon
					? suggestions.lexiconRevision
					: null,
			},
			this.now
		);
	}

	/**
	 * Records text the writer supplied themselves.
	 *
	 * Used both when they reject every suggestion and when recognition never
	 * ran at all — which is the offline case, and is why handwriting stays
	 * fully usable with no recognizer.
	 *
	 * @param suggestions The set in view, or a bare subject when none ran.
	 * @param text        Exactly what the writer typed.
	 * @return The transcription record.
	 */
	public confirmTypedText(
		suggestions: Pick<SuggestionSet, 'inkDocumentId' | 'strokeIds'>,
		text: string
	): InkTranscription {
		const match = this.lexicon?.lookup(text) ?? null;

		return createInkTranscription(
			{
				inkDocumentId: suggestions.inkDocumentId,
				strokeIds: suggestions.strokeIds,
				text,
				// Typed text that happens to be an approved word is still
				// typed text: the source records what the writer did, not
				// what the lexicon thinks of the result.
				source: match === null ? 'not-listed' : 'typed',
				lexiconEntryId: match?.entryId ?? null,
				lexiconRevision: match === null ? null : this.lexiconRevision,
			},
			this.now
		);
	}

	/**
	 * Packages an unlisted word as evidence for the consuming product.
	 *
	 * Calling this changes nothing anywhere. It returns a value; what happens
	 * to that value is the product's business. This package cannot and must
	 * not add a word to the approved Dictionary.
	 *
	 * @param transcription The confirmed reading the writer wants reviewed.
	 * @return The evidence package.
	 */
	public offerUnlistedWord(
		transcription: InkTranscription
	): UnlistedWordEvidence {
		return {
			inkDocumentId: transcription.inkDocumentId,
			strokeIds: transcription.strokeIds,
			text: transcription.text,
			languageTag: this.languageTag,
			lexiconRevision: this.lexiconRevision,
			offeredAt: this.now().toISOString(),
		};
	}
}
