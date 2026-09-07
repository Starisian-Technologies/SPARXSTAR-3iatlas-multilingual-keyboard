/**
 * The link between handwriting and confirmed text.
 *
 * Two records are kept, never one. The ink is the writer's own mark — the
 * evidence — and the transcription is what a person confirmed it says. Storing
 * only the text would destroy the evidence; storing only the ink would lose
 * the reading. Keeping both, joined by stable identifiers, is what lets a
 * later recognition model be evaluated against real Mandinka handwriting
 * without anyone editing the original document.
 *
 * The transcription is a claim ABOUT the ink, not a correction OF it. Nothing
 * in this module ever rewrites a stroke.
 */

import type { InkDocument } from './schema';
import { createInkId } from './schema';

/** The only transcription schema version this package writes or reads. */
export const TRANSCRIPTION_SCHEMA_VERSION = 1;

/**
 * How the confirmed text was arrived at.
 *
 * `recognized-candidate` — the writer chose a suggestion offered by a
 * recognizer. `typed` — the writer typed the text themselves, having rejected
 * or never seen a suggestion. `not-listed` — the writer confirmed their own
 * spelling for a word the approved lexicon does not carry.
 */
export type TranscriptionSource =
	'recognized-candidate' | 'typed' | 'not-listed';

/** A confirmed reading of some ink. */
export interface InkTranscription {
	readonly schemaVersion: typeof TRANSCRIPTION_SCHEMA_VERSION;
	readonly id: string;
	/** The ink document this reading is of. */
	readonly inkDocumentId: string;
	/** The exact strokes this reading covers, in draw order. */
	readonly strokeIds: readonly string[];
	/**
	 * The text a person confirmed, verbatim.
	 *
	 * Stored exactly as confirmed — same code points, same diacritics, same
	 * vowel length, same digraphs. Nothing in this package normalizes it.
	 */
	readonly text: string;
	readonly source: TranscriptionSource;
	/**
	 * Identifier of the approved dictionary entry this text matched, when it
	 * matched one. Null for a word the approved lexicon does not carry.
	 */
	readonly lexiconEntryId: string | null;
	/** Revision of the lexicon the match was made against. Null when unmatched. */
	readonly lexiconRevision: string | null;
	/** ISO 8601 time the person confirmed it. */
	readonly confirmedAt: string;
}

/** Everything needed to record a confirmation. */
export interface TranscriptionInput {
	readonly inkDocumentId: string;
	readonly strokeIds: readonly string[];
	readonly text: string;
	readonly source: TranscriptionSource;
	readonly lexiconEntryId?: string | null;
	readonly lexiconRevision?: string | null;
}

/**
 * Records a confirmed reading.
 *
 * @param input Confirmation details.
 * @param now   Injected clock, so tests are deterministic.
 * @return The transcription record.
 */
export const createInkTranscription = (
	input: TranscriptionInput,
	now: () => Date = () => new Date()
): InkTranscription => ({
	schemaVersion: TRANSCRIPTION_SCHEMA_VERSION,
	id: createInkId('transcript'),
	inkDocumentId: input.inkDocumentId,
	strokeIds: [...input.strokeIds],
	text: input.text,
	source: input.source,
	lexiconEntryId: input.lexiconEntryId ?? null,
	lexiconRevision: input.lexiconRevision ?? null,
	confirmedAt: now().toISOString(),
});

/**
 * Checks that a transcription still refers to strokes the document holds.
 *
 * A transcription whose strokes were erased is dangling: the reading survives
 * but its evidence does not, so a consumer must be able to detect that rather
 * than present the text as still backed by handwriting.
 *
 * @param transcription Record to check.
 * @param document      Document it claims to describe.
 * @return True when the document is the right one and every stroke is present.
 */
export const isTranscriptionIntact = (
	transcription: InkTranscription,
	document: InkDocument
): boolean => {
	if (transcription.inkDocumentId !== document.id) {
		return false;
	}

	const present = new Set(document.strokes.map((stroke) => stroke.id));

	return transcription.strokeIds.every((id) => present.has(id));
};
