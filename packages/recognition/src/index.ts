/**
 * Provider-neutral handwriting recognition for the 3iAtlas Input Toolkit.
 *
 * WHAT THIS PACKAGE DOES NOT DO, on purpose:
 *
 * - It makes no network request. Not one. The consuming product supplies both
 *   the recognizer and the lexicon transport.
 * - It holds no vendor SDK and no vendor credential. A recognition provider
 *   that needs a key is implemented server-side by the consuming product, so
 *   the key never reaches a browser bundle.
 * - It never writes to a dictionary. An unlisted word becomes evidence handed
 *   back to the product, and approval happens under linguistic authority
 *   somewhere else entirely.
 *
 * The default recognizer is {@link UnavailableRecognizer}: recognition is
 * OPT-IN, and everything else in the toolkit works without it.
 */

export type {
	HandwritingRecognizer,
	RecognitionCandidate,
	RecognitionFailureReason,
	RecognitionRequest,
	RecognitionResult,
} from './port';
export { UnavailableRecognizer, isHandwritingRecognizer } from './port';

export type {
	LexiconEntry,
	LexiconEntryStatus,
	LexiconMatch,
	LexiconParseIssue,
	LexiconParseResult,
	SpellLexicon,
} from './lexicon';
export {
	SPELL_LEXICON_SCHEMA_VERSION,
	LexiconIndex,
	isNfc,
	parseSpellLexicon,
} from './lexicon';

export type {
	LexiconFetcher,
	LexiconManifestEntry,
	LexiconRefreshFailure,
	LexiconRefreshResult,
	LexiconStore,
} from './lexicon-cache';
export {
	LexiconCache,
	MemoryLexiconStore,
	readLexiconManifest,
	sha256Hex,
} from './lexicon-cache';

export type {
	RecognitionSessionOptions,
	RecognitionSubject,
	SuggestionSet,
	UnlistedWordEvidence,
} from './session';
export { RecognitionSession } from './session';
