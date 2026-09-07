/**
 * Provider-neutral handwriting-recognition port.
 *
 * No vendor name appears in this file, and none may. A recognizer is whatever
 * satisfies {@link HandwritingRecognizer}: a server-side adapter reached
 * through the consuming product, an on-device model, or nothing at all.
 *
 * This package makes NO network requests. A recognizer that needs one is
 * supplied by the consuming product, which owns its own authenticated
 * transport, its credentials, and its consent policy. That is not an
 * abstraction for its own sake — it is what keeps recognition credentials out
 * of the browser bundle entirely, and what lets the whole capability be
 * switched off without touching the ink code.
 */

import type { InkStroke } from '@starisian/3iatlas-input-ink';

/** What is being asked of a recognizer. */
export interface RecognitionRequest {
	/** Identifier of the document the strokes came from. */
	readonly inkDocumentId: string;
	/** The strokes to read, in draw order. */
	readonly strokes: readonly InkStroke[];
	/** Surface width the coordinates are expressed in, in CSS pixels. */
	readonly canvasWidthPx: number;
	readonly canvasHeightPx: number;
	/** BCP 47 tag of the language the writer selected. */
	readonly languageTag: string;
	/**
	 * Revision of the approved lexicon the recognizer should bias toward.
	 *
	 * Passed so a result can be attributed to an exact lexicon revision. A
	 * recognizer that cannot use it must ignore it rather than fail.
	 */
	readonly lexiconRevision: string | null;
	/** Aborts an in-flight request, e.g. when the writer keeps writing. */
	readonly signal?: AbortSignal;
}

/** One proposed reading. */
export interface RecognitionCandidate {
	/** Stable identifier within this result, so a UI can key on it. */
	readonly id: string;
	/**
	 * The proposed text, verbatim from the recognizer.
	 *
	 * Never normalized, case-folded, or stripped of diacritics by this
	 * package. What a recognizer proposed is what the writer is shown.
	 */
	readonly text: string;
	/** Recognizer confidence in 0..1, or null when it reports none. */
	readonly confidence: number | null;
	/**
	 * Whether this text is present in the approved lexicon.
	 *
	 * Filled in by {@link module:lexicon-match}, not by the recognizer.
	 * `false` is not a verdict that the word is wrong — it means the approved
	 * lexicon does not carry it, which is a different statement.
	 */
	readonly inApprovedLexicon: boolean;
	/** Approved entry identifier, when this text matched one. */
	readonly lexiconEntryId: string | null;
}

/** Why recognition could not produce candidates. */
export type RecognitionFailureReason =
	| 'disabled'
	| 'offline'
	| 'not-configured'
	| 'unsupported-language'
	| 'provider-error'
	| 'cancelled'
	| 'timeout';

/** The outcome of a recognition attempt. */
export type RecognitionResult =
	| {
			readonly ok: true;
			readonly candidates: readonly RecognitionCandidate[];
			/** Lexicon revision the candidates were checked against. */
			readonly lexiconRevision: string | null;
	  }
	| {
			readonly ok: false;
			readonly reason: RecognitionFailureReason;
	  };

/** Anything that can propose readings for handwriting. */
export interface HandwritingRecognizer {
	/** Stable identifier for diagnostics. Never shown to a writer. */
	readonly id: string;
	/**
	 * Whether recognition can be attempted right now.
	 *
	 * Consulted before a request so a UI can present the ink as un-recognizable
	 * rather than offering a control that will fail.
	 */
	readonly isAvailable: () => boolean;
	/** Language tags this recognizer will accept. */
	readonly supportedLanguages: () => readonly string[];
	readonly recognize: (
		request: RecognitionRequest
	) => Promise<RecognitionResult>;
}

/**
 * The recognizer used when none is configured or none is permitted.
 *
 * This is the DEFAULT throughout the toolkit. Recognition is opt-in: a product
 * that has not wired up a recognizer, or is running under a policy that
 * forbids one, gets this — and handwriting capture, editing, saving, and
 * reopening all keep working, because none of them ask a recognizer anything.
 */
export class UnavailableRecognizer implements HandwritingRecognizer {
	public readonly id = 'unavailable';

	private readonly reason: RecognitionFailureReason;

	/**
	 * @param reason Why recognition is unavailable, for diagnostics.
	 */
	public constructor(reason: RecognitionFailureReason = 'disabled') {
		this.reason = reason;
	}

	public readonly isAvailable = (): boolean => false;

	public readonly supportedLanguages = (): readonly string[] => [];

	public readonly recognize = async (
		request: RecognitionRequest
	): Promise<RecognitionResult> => {
		void request;

		return { ok: false, reason: this.reason };
	};
}

/**
 * Reports whether an object satisfies the recognizer contract.
 *
 * Recognizers are consumer-supplied and therefore untrusted (specification
 * section 10).
 *
 * @param candidate Value to test.
 * @return True when every required member is present.
 */
export const isHandwritingRecognizer = (
	candidate: unknown
): candidate is HandwritingRecognizer => {
	if (typeof candidate !== 'object' || candidate === null) {
		return false;
	}

	const recognizer = candidate as Partial<HandwritingRecognizer>;

	return (
		typeof recognizer.id === 'string' &&
		typeof recognizer.isAvailable === 'function' &&
		typeof recognizer.supportedLanguages === 'function' &&
		typeof recognizer.recognize === 'function'
	);
};
