/**
 * The 3iAtlas Input Toolkit facade.
 *
 * One object a product can hold that covers both ways of getting language into
 * a document: the keyboard path (device keyboard plus the approved helper
 * characters) and the pencil path (digital ink, optionally recognized). It is
 * framework-agnostic; the React package is a binding over the same pieces.
 *
 * WHAT THIS OWNS: reusable input. Mounting a surface, switching between
 * keyboard and pencil, serializing and restoring strokes, asking for
 * suggestions, recording a confirmation, and inserting confirmed text at the
 * caret.
 *
 * WHAT THIS DOES NOT OWN, and must not grow into: document ownership,
 * synchronization, encryption, evidence submission, linguistic approval, or
 * dictionary publication. Those belong to the consuming products. The toolkit
 * hands back values; what happens to them is the product's business.
 */

import type {
	EditorAdapter,
	InputMode,
	LanguageProfile,
} from '@starisian/3iatlas-multilingual-input-core';
import {
	DEFAULT_INPUT_MODE,
	detectCapabilities,
	normalizeInputText,
	observeConnectivity,
	readConnectivity,
} from '@starisian/3iatlas-multilingual-input-core';
import type {
	ConnectivityStatus,
	RuntimeCapabilities,
} from '@starisian/3iatlas-multilingual-input-core';
import type {
	InkDocument,
	InkSurface,
	InkSurfaceOptions,
	InkTranscription,
} from '@starisian/3iatlas-input-ink';
import {
	mountInkSurface,
	parseInkDocument,
} from '@starisian/3iatlas-input-ink';
import type {
	HandwritingRecognizer,
	LexiconIndex,
	SuggestionSet,
	UnlistedWordEvidence,
} from '@starisian/3iatlas-input-recognition';
import {
	RecognitionSession,
	UnavailableRecognizer,
} from '@starisian/3iatlas-input-recognition';

/** How the writer is currently entering language. */
export type InputSurfaceKind = 'keyboard' | 'pencil';

/**
 * Non-content lifecycle events.
 *
 * Section 10 permits reporting non-content events only. Nothing here carries
 * typed text, handwritten strokes, or a recognized word — a `text-confirmed`
 * event says that a confirmation happened and how, never what it said.
 */
export type InputToolkitEvent =
	| { readonly type: 'surface-changed'; readonly surface: InputSurfaceKind }
	| { readonly type: 'mode-changed'; readonly mode: InputMode }
	| { readonly type: 'profile-changed'; readonly profileId: string }
	| { readonly type: 'character-inserted'; readonly profileId: string }
	| { readonly type: 'ink-changed'; readonly strokeCount: number }
	| {
			readonly type: 'recognition-completed';
			readonly candidateCount: number;
			readonly failure: string | null;
	  }
	| {
			readonly type: 'text-confirmed';
			readonly source: InkTranscription['source'];
			readonly inApprovedLexicon: boolean;
	  }
	| { readonly type: 'connectivity-changed'; readonly online: boolean | null };

/** What the toolkit can do here, and whether the network is reachable. */
export interface InputToolkitStatus {
	readonly capabilities: RuntimeCapabilities;
	readonly connectivity: ConnectivityStatus;
	/** Whether digital ink can be captured on this device at all. */
	readonly inkSupported: boolean;
	/** Whether a recognizer is configured AND currently willing to run. */
	readonly recognitionAvailable: boolean;
	/** Lexicon revision in force, or null when none is loaded. */
	readonly lexiconRevision: string | null;
	readonly activeSurface: InputSurfaceKind;
	readonly inputMode: InputMode;
	readonly activeProfileId: string | null;
}

/** Options accepted by {@link createInputToolkit}. */
export interface InputToolkitOptions {
	/** Profiles this product ships (section 13). */
	readonly profiles: readonly LanguageProfile[];
	readonly initialProfileId?: string;
	readonly initialInputMode?: InputMode;
	/** Adapter for the host writing surface. */
	readonly adapter?: EditorAdapter | null;
	/**
	 * Recognizer to use.
	 *
	 * Defaults to {@link UnavailableRecognizer}. Recognition is opt-in, and
	 * every other capability works without one.
	 */
	readonly recognizer?: HandwritingRecognizer;
	/** Approved lexicon to check suggestions against. */
	readonly lexicon?: LexiconIndex | null;
	readonly onEvent?: (event: InputToolkitEvent) => void;
}

/** The toolkit handle. */
export interface InputToolkit {
	// --- keyboard path -----------------------------------------------------
	readonly getActiveProfile: () => LanguageProfile | null;
	readonly setActiveProfileId: (profileId: string) => void;
	readonly getInputMode: () => InputMode;
	readonly setInputMode: (mode: InputMode) => void;
	/** Inserts one approved character at the caret. */
	readonly insertCharacter: (character: string) => boolean;

	// --- surface switching -------------------------------------------------
	readonly getActiveSurface: () => InputSurfaceKind;
	/** Switches between keyboard and pencil. */
	readonly setActiveSurface: (surface: InputSurfaceKind) => void;

	// --- pencil path -------------------------------------------------------
	/** Mounts a digital-ink surface. Replaces any surface already mounted. */
	readonly mountInk: (
		host: HTMLElement,
		options?: InkSurfaceOptions
	) => InkSurface;
	/**
	 * Adopts an ink surface mounted elsewhere.
	 *
	 * The React binding mounts its own surface, and a product may mount one by
	 * hand. Without this, the facade could only drive a surface it created
	 * itself, and `requestRecognition` would have nothing to read — which
	 * would push every React consumer into reimplementing the recognition
	 * round. Passing null detaches without destroying: the owner that mounted
	 * the surface is the one that tears it down.
	 */
	readonly attachInkSurface: (surface: InkSurface | null) => void;
	readonly getInkSurface: () => InkSurface | null;
	/** Destroys a surface this toolkit mounted. A no-op for an attached one. */
	readonly unmountInk: () => void;
	/** The current ink document, or null when nothing is mounted. */
	readonly serializeInk: () => InkDocument | null;
	/**
	 * Reopens a saved ink document.
	 *
	 * Refuses a document that does not satisfy the schema rather than opening
	 * a partially-read page.
	 */
	readonly restoreInk: (serialized: unknown) => boolean;

	// --- recognition -------------------------------------------------------
	/** Asks for readings of the ink currently on the surface. */
	readonly requestRecognition: () => Promise<SuggestionSet | null>;
	/** Records the writer's choice of a suggestion. Inserts nothing. */
	readonly confirmCandidate: (
		suggestions: SuggestionSet,
		candidateId: string
	) => InkTranscription | null;
	/** Records text the writer supplied. Inserts nothing. */
	readonly confirmTypedText: (
		suggestions: Pick<SuggestionSet, 'inkDocumentId' | 'strokeIds'>,
		text: string
	) => InkTranscription;
	/**
	 * Packages an unlisted word for the product's own review workflow.
	 *
	 * Writes to no dictionary. See `UnlistedWordEvidence`.
	 */
	readonly offerUnlistedWord: (
		transcription: InkTranscription
	) => UnlistedWordEvidence;
	/**
	 * Inserts a confirmed transcription at the caret.
	 *
	 * Separate from confirming on purpose: a product may want to record the
	 * confirmation without writing it into the document yet.
	 */
	readonly insertTranscription: (transcription: InkTranscription) => boolean;

	// --- status ------------------------------------------------------------
	readonly readStatus: () => InputToolkitStatus;
	readonly setAdapter: (adapter: EditorAdapter | null) => void;
	readonly destroy: () => void;
}

/**
 * Creates the toolkit.
 *
 * @param options Toolkit configuration.
 * @return The toolkit handle.
 */
export const createInputToolkit = (
	options: InputToolkitOptions
): InputToolkit => {
	const emit = (event: InputToolkitEvent): void => {
		try {
			options.onEvent?.(event);
		} catch {
			// A consumer's telemetry must not break the writer's session.
		}
	};

	let adapter = options.adapter ?? null;
	let inputMode: InputMode = options.initialInputMode ?? DEFAULT_INPUT_MODE;
	let activeSurface: InputSurfaceKind = 'keyboard';
	let inkSurface: InkSurface | null = null;
	// Tracked so `unmountInk` and `destroy` never tear down a surface some
	// other owner — the React binding, say — is still rendering.
	let ownsInkSurface = false;

	let activeProfile: LanguageProfile | null =
		options.profiles.find(
			(profile) => profile.id === options.initialProfileId
		) ??
		options.profiles[0] ??
		null;

	const session = new RecognitionSession({
		recognizer: options.recognizer ?? new UnavailableRecognizer(),
		lexicon: options.lexicon ?? null,
		languageTag: activeProfile?.bcp47Tag ?? 'und',
	});

	let connectivity = readConnectivity();

	const stopWatchingConnectivity = observeConnectivity((status) => {
		connectivity = status;
		emit({ type: 'connectivity-changed', online: status.online });
	});

	return {
		getActiveProfile: () => activeProfile,

		setActiveProfileId: (profileId) => {
			const next = options.profiles.find((profile) => profile.id === profileId);

			if (next === undefined || next.id === activeProfile?.id) {
				return;
			}

			activeProfile = next;
			emit({ type: 'profile-changed', profileId: next.id });
		},

		getInputMode: () => inputMode,

		setInputMode: (mode) => {
			if (mode === inputMode) {
				return;
			}

			inputMode = mode;
			emit({ type: 'mode-changed', mode });
		},

		insertCharacter: (character) => {
			if (adapter === null || activeProfile === null) {
				return false;
			}

			const text = normalizeInputText(
				character,
				activeProfile.normalizationForm
			);

			try {
				if (adapter.insert({ text, profileId: activeProfile.id }) === null) {
					return false;
				}

				adapter.restoreFocus();
			} catch {
				return false;
			}

			emit({ type: 'character-inserted', profileId: activeProfile.id });

			return true;
		},

		getActiveSurface: () => activeSurface,

		setActiveSurface: (surface) => {
			if (surface === activeSurface) {
				return;
			}

			activeSurface = surface;
			// Switching away from the pencil abandons any recognition round in
			// flight, so a late result cannot surface over the keyboard.
			if (surface === 'keyboard') {
				session.cancel();
			}

			emit({ type: 'surface-changed', surface });
		},

		mountInk: (host, inkOptions) => {
			if (ownsInkSurface) {
				inkSurface?.destroy();
			}

			ownsInkSurface = true;
			inkSurface = mountInkSurface(host, {
				...inkOptions,
				label: inkOptions?.label ?? 'Handwriting area',
				onChange: (document) => {
					inkOptions?.onChange?.(document);
					emit({
						type: 'ink-changed',
						strokeCount: document.strokes.length,
					});
				},
			});

			return inkSurface;
		},

		attachInkSurface: (surface) => {
			if (ownsInkSurface && inkSurface !== null && inkSurface !== surface) {
				inkSurface.destroy();
			}

			ownsInkSurface = false;
			inkSurface = surface;

			if (surface === null) {
				session.cancel();
			}
		},

		getInkSurface: () => inkSurface,

		unmountInk: () => {
			session.cancel();

			if (ownsInkSurface) {
				inkSurface?.destroy();
			}

			inkSurface = null;
			ownsInkSurface = false;
		},

		serializeInk: () => inkSurface?.serialize() ?? null,

		restoreInk: (serialized) => {
			if (inkSurface === null) {
				return false;
			}

			const parsed = parseInkDocument(serialized);

			if (!parsed.ok) {
				return false;
			}

			inkSurface.restore(parsed.document);

			return true;
		},

		requestRecognition: async () => {
			if (inkSurface === null) {
				return null;
			}

			const document = inkSurface.serialize();
			const suggestions = await session.propose({
				inkDocumentId: document.id,
				strokes: document.strokes,
				canvasWidthPx: document.canvas.widthPx,
				canvasHeightPx: document.canvas.heightPx,
			});

			emit({
				type: 'recognition-completed',
				candidateCount: suggestions.candidates.length,
				failure: suggestions.failure,
			});

			return suggestions;
		},

		confirmCandidate: (suggestions, candidateId) => {
			const transcription = session.confirmCandidate(suggestions, candidateId);

			if (transcription !== null) {
				emit({
					type: 'text-confirmed',
					source: transcription.source,
					inApprovedLexicon: transcription.lexiconEntryId !== null,
				});
			}

			return transcription;
		},

		confirmTypedText: (suggestions, text) => {
			const transcription = session.confirmTypedText(suggestions, text);

			emit({
				type: 'text-confirmed',
				source: transcription.source,
				inApprovedLexicon: transcription.lexiconEntryId !== null,
			});

			return transcription;
		},

		offerUnlistedWord: (transcription) =>
			session.offerUnlistedWord(transcription),

		insertTranscription: (transcription) => {
			if (adapter === null || activeProfile === null) {
				return false;
			}

			try {
				// The confirmed text is inserted VERBATIM. No normalization
				// happens here, unlike `insertCharacter`: a single approved
				// character is package data, whereas this is a word a person
				// read and confirmed, and rewriting it would be exactly the
				// silent substitution the toolkit exists to prevent.
				if (
					adapter.insert({
						text: transcription.text,
						profileId: activeProfile.id,
					}) === null
				) {
					return false;
				}

				adapter.restoreFocus();
			} catch {
				return false;
			}

			return true;
		},

		readStatus: () => {
			const capabilities = detectCapabilities();

			return {
				capabilities,
				connectivity,
				inkSupported: capabilities.pointerEvents && capabilities.canvas2d,
				recognitionAvailable: session.isAvailable,
				lexiconRevision: session.lexiconRevision,
				activeSurface,
				inputMode,
				activeProfileId: activeProfile?.id ?? null,
			};
		},

		setAdapter: (next) => {
			adapter = next;
		},

		destroy: () => {
			session.cancel();

			if (ownsInkSurface) {
				inkSurface?.destroy();
			}

			inkSurface = null;
			ownsInkSurface = false;
			stopWatchingConnectivity();
		},
	};
};
