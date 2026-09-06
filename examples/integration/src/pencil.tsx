/**
 * Pencil demonstration: writing, recognizing, confirming, and reopening.
 *
 * Exercises the REAL exported packages — no logic is reimplemented here. Every
 * behavior on screen comes from `@starisian/3iatlas-input-ink`,
 * `@starisian/3iatlas-input-recognition`, and the toolkit facade.
 *
 * The recognizer below is a LOCAL STUB, and deliberately so. No handwriting
 * leaves this page: the toolkit's recognition port is provider-neutral and
 * makes no network request of its own, so a demonstration recognizer proves
 * the flow without a vendor, a credential, or a byte leaving the device. A
 * real deployment supplies a recognizer backed by its own authenticated
 * server-side endpoint.
 *
 * The offline control switches that stub off, which is what a device with no
 * connectivity looks like to this code: suggestions stop, and writing,
 * editing, saving, and reopening carry on unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EditorAdapter } from '@starisian/3iatlas-multilingual-input-core';
import type {
	InkDocument,
	InkSurface,
	InkTranscription,
} from '@starisian/3iatlas-input-ink';
import type { SuggestionSet } from '@starisian/3iatlas-input-recognition';
import {
	InkCanvas,
	RecognitionSuggestions,
} from '@starisian/3iatlas-multilingual-input-react';
import type {
	InkToolbarLabels,
	RecognitionLabels,
} from '@starisian/3iatlas-multilingual-input-react';
import {
	LexiconIndex,
	UnavailableRecognizer,
} from '@starisian/3iatlas-input-recognition';
import type {
	HandwritingRecognizer,
	SpellLexicon,
} from '@starisian/3iatlas-input-recognition';
import {
	hasPressureData,
	parseInkDocument,
} from '@starisian/3iatlas-input-ink';
import { createInputToolkit } from '@starisian/3iatlas-multilingual-input';
import { MANDINKA_GM_PROFILE } from '@starisian/3iatlas-multilingual-input-profiles';

const TOOLBAR_LABELS: InkToolbarLabels = {
	pen: 'Pen',
	highlighter: 'Highlighter',
	eraser: 'Eraser',
	select: 'Select',
	undo: 'Undo',
	redo: 'Redo',
	clear: 'Clear',
	deleteSelection: 'Delete selected',
	confirmClear: 'Yes, clear it',
	cancelClear: 'Keep my writing',
	clearPrompt: 'Clear everything you have written?',
	surface: 'Handwriting area',
};

const RECOGNITION_LABELS: RecognitionLabels = {
	panel: 'Suggested words',
	inkAlt: 'What you wrote',
	heading: 'Is this your word?',
	notInLexicon: 'not in the dictionary',
	inLexicon: 'in the dictionary',
	useThis: 'Use this',
	notListed: 'My word is not listed',
	keepMySpelling: 'Keep my spelling',
	ownSpellingLabel: 'Your spelling',
	submitForReview: 'Keep it and send for review',
	cancel: 'Cancel',
	unavailable: (reason) =>
		reason === 'offline' || reason === 'disabled'
			? 'Suggestions are unavailable right now. You can still write, save, and keep your own spelling.'
			: `Suggestions unavailable (${reason}).`,
	noCandidates: 'No suggestions for this writing.',
};

/**
 * A stand-in for a published lexicon.
 *
 * NOT a dictionary. These forms exist to demonstrate the approved/not-approved
 * distinction in the UI; the real lexicon is published by the Dictionary with
 * a revision and a checksum, and is never authored in a consumer product.
 */
const DEMONSTRATION_LEXICON: SpellLexicon = {
	schemaVersion: 1,
	language: 'mnk',
	revision: 'demo-revision-1',
	orthography: 'peace-corps-gm',
	generatedAt: '2026-09-01T00:00:00.000Z',
	entries: [
		{ id: 'demo-1', headword: 'kuŋo', variants: ['kungo'], status: 'approved' },
		{ id: 'demo-2', headword: 'baa', variants: [], status: 'approved' },
	],
};

/**
 * A recognizer that proposes fixed readings, entirely on this device.
 *
 * It ignores the strokes: the point of the demonstration is the FLOW —
 * suggest, compare against the ink, confirm, insert — not the accuracy of a
 * model. `kingo` is included because an English-looking proposal must be
 * visibly marked as not in the approved lexicon and must never be substituted
 * for the Mandinka word on its own.
 */
const localDemonstrationRecognizer: HandwritingRecognizer = {
	id: 'local-demonstration',
	isAvailable: () => true,
	supportedLanguages: () => ['mnk-Latn-GM'],
	recognize: async () => ({
		ok: true,
		lexiconRevision: null,
		candidates: [
			{
				id: 'demo-a',
				text: 'kuŋo',
				confidence: 0.82,
				inApprovedLexicon: false,
				lexiconEntryId: null,
			},
			{
				id: 'demo-b',
				text: 'kungo',
				confidence: 0.55,
				inApprovedLexicon: false,
				lexiconEntryId: null,
			},
			{
				id: 'demo-c',
				text: 'kingo',
				confidence: 0.31,
				inApprovedLexicon: false,
				lexiconEntryId: null,
			},
		],
	}),
};

/** Props accepted by {@link PencilDemo}. */
export interface PencilDemoProps {
	/** Adapter for whichever writing surface is currently targeted. */
	readonly adapter: EditorAdapter | null;
}

/**
 * Demonstrates the pencil path end to end.
 *
 * @param props Demonstration configuration.
 * @return The demonstration section.
 */
export const PencilDemo = ({ adapter }: PencilDemoProps): JSX.Element => {
	const [offline, setOffline] = useState(false);
	const [suggestions, setSuggestions] = useState<SuggestionSet | null>(null);
	const [confirmed, setConfirmed] = useState<InkTranscription[]>([]);
	const [saved, setSaved] = useState<string | null>(null);
	const [notice, setNotice] = useState<string>('');
	const [document, setDocument] = useState<InkDocument | null>(null);
	const surfaceRef = useRef<InkSurface | null>(null);

	// Rebuilt when connectivity flips so the toolkit sees a recognizer that
	// genuinely reports itself unavailable, rather than a flag checked in the
	// UI layer — the offline path has to be exercised, not simulated.
	const toolkit = useMemo(
		() =>
			createInputToolkit({
				profiles: [MANDINKA_GM_PROFILE],
				adapter,
				recognizer: offline
					? new UnavailableRecognizer('offline')
					: localDemonstrationRecognizer,
				lexicon: new LexiconIndex(DEMONSTRATION_LEXICON),
			}),
		[adapter, offline]
	);

	// The React binding mounts the surface; the facade adopts it, so one
	// object drives both the keyboard and the pencil path.
	const onReady = useCallback((surface: InkSurface | null) => {
		surfaceRef.current = surface;
		setDocument(surface?.serialize() ?? null);
	}, []);

	// Re-attach whenever the toolkit is rebuilt — switching connectivity or
	// changing the target surface makes a new one, and a toolkit that has not
	// adopted the mounted canvas has nothing to recognize. The old one is
	// destroyed so its connectivity subscription does not leak.
	useEffect(() => {
		toolkit.attachInkSurface(surfaceRef.current);

		return () => toolkit.destroy();
	}, [toolkit]);

	const recognize = useCallback(async () => {
		setDocument(surfaceRef.current?.serialize() ?? null);
		setSuggestions(await toolkit.requestRecognition());
	}, [toolkit]);

	return (
		<section className="surface" data-testid="surface-pencil">
			<h2>Pencil</h2>

			<label>
				<input
					type="checkbox"
					data-testid="offline-toggle"
					checked={offline}
					onChange={(event) => setOffline(event.target.checked)}
				/>{' '}
				Simulate no connectivity
			</label>

			<InkCanvas
				labels={TOOLBAR_LABELS}
				onReady={onReady}
				onChange={setDocument}
			/>

			<div>
				<button type="button" data-testid="recognize" onClick={recognize}>
					Suggest words
				</button>
				<button
					type="button"
					data-testid="save-ink"
					onClick={() => {
						const page = surfaceRef.current?.serialize();

						if (page === undefined) {
							return;
						}

						setSaved(JSON.stringify(page));
						setNotice(`Saved ${page.strokes.length} stroke(s).`);
					}}
				>
					Save
				</button>
				<button
					type="button"
					data-testid="reopen-ink"
					disabled={saved === null}
					onClick={() => {
						if (saved === null) {
							return;
						}

						const parsed = parseInkDocument(saved);

						if (!parsed.ok) {
							setNotice('Saved handwriting could not be read.');

							return;
						}

						surfaceRef.current?.restore(parsed.document);
						setNotice(`Reopened ${parsed.document.strokes.length} stroke(s).`);
					}}
				>
					Reopen
				</button>
			</div>

			<p role="status" data-testid="ink-notice">
				{notice}
			</p>
			<p>
				Strokes on the page:{' '}
				<span data-testid="stroke-count">
					{document === null ? 0 : document.strokes.length}
				</span>
			</p>
			<p>
				Pressure recorded:{' '}
				<span data-testid="pressure-recorded">
					{document === null
						? 'none'
						: document.strokes.some((stroke) => hasPressureData(stroke))
							? 'yes'
							: 'no'}
				</span>
			</p>

			{document !== null && (
				<RecognitionSuggestions
					labels={RECOGNITION_LABELS}
					document={document}
					suggestions={suggestions}
					onConfirmCandidate={(candidateId) => {
						if (suggestions === null) {
							return;
						}

						const transcription = toolkit.confirmCandidate(
							suggestions,
							candidateId
						);

						if (transcription === null) {
							return;
						}

						setConfirmed((previous) => [...previous, transcription]);
						toolkit.insertTranscription(transcription);
						setSuggestions(null);
					}}
					onConfirmOwnSpelling={(text, submitForReview) => {
						const transcription = toolkit.confirmTypedText(
							suggestions ?? {
								inkDocumentId: document.id,
								strokeIds: document.strokes.map((stroke) => stroke.id),
							},
							text
						);

						setConfirmed((previous) => [...previous, transcription]);
						toolkit.insertTranscription(transcription);

						if (submitForReview) {
							const evidence = toolkit.offerUnlistedWord(transcription);

							// The toolkit hands back evidence and does nothing
							// with it. Routing this into a review workflow is
							// the consuming product's job, not the toolkit's,
							// and it is never a write to the Dictionary.
							setNotice(
								`Kept your spelling and prepared it for review ` +
									`(${evidence.strokeIds.length} stroke(s) of evidence).`
							);
						} else {
							setNotice('Kept your spelling.');
						}

						setSuggestions(null);
					}}
				/>
			)}

			<h3>Confirmed readings</h3>
			<ul data-testid="confirmed-list">
				{confirmed.map((transcription) => (
					<li key={transcription.id}>
						{transcription.text} — {transcription.source}
						{transcription.lexiconRevision === null
							? ''
							: ` (lexicon ${transcription.lexiconRevision})`}
					</li>
				))}
			</ul>
		</section>
	);
};
