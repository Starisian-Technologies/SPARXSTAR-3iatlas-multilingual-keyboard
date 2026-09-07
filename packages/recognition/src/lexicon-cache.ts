/**
 * Versioned local cache for approved lexicons.
 *
 * The point of the cache is that a writer on an intermittent connection keeps
 * spelling assistance between sessions, and that a device does not re-download
 * a lexicon that has not changed. Freshness is decided by the publisher's
 * REVISION, never by a local timer: a lexicon does not go stale because a day
 * passed, it goes stale when the Dictionary approves or withdraws a word.
 *
 * This module makes no network request. The consuming product supplies both
 * the storage and the fetch, so the toolkit never learns an origin, never
 * holds a credential, and can be used in a product that ships its lexicon as a
 * bundled asset instead of fetching one.
 *
 * Only the minimum approved data is stored: identifiers and approved
 * spellings. Definitions, translations, audio, examples, and every other
 * dictionary field are deliberately absent from this contract.
 */

import type { LexiconParseIssue } from './lexicon';
import { LexiconIndex, parseSpellLexicon } from './lexicon';

/** What the publisher's manifest says about one language's artifact. */
export interface LexiconManifestEntry {
	/** Language identifier exactly as the Dictionary publishes it. */
	readonly language: string;
	/** Opaque revision identifier. Compared for equality only. */
	readonly revision: string;
	/** Lowercase hex SHA-256 of the artifact bytes. */
	readonly sha256: string;
	/** Entry count, for diagnostics and for a sanity check after download. */
	readonly entryCount: number;
	/** Artifact size in bytes, so a consumer can refuse an oversized download. */
	readonly sizeBytes: number;
}

/** Storage supplied by the consuming product. */
export interface LexiconStore {
	/** Returns the stored artifact text for a language, or null. */
	readonly read: (language: string) => Promise<string | null>;
	/** Replaces the stored artifact for a language. */
	readonly write: (language: string, artifact: string) => Promise<void>;
	/** Removes a language's artifact. */
	readonly remove: (language: string) => Promise<void>;
}

/** Fetches an artifact's text. Supplied by the consuming product. */
export type LexiconFetcher = (
	entry: LexiconManifestEntry,
	signal?: AbortSignal
) => Promise<string>;

/** Why a refresh did not install a new lexicon. */
export type LexiconRefreshFailure =
	| 'unchanged'
	| 'fetch-failed'
	| 'checksum-mismatch'
	| 'checksum-unavailable'
	| 'invalid-payload'
	| 'revision-mismatch'
	/** A newer refresh for the same language installed first. */
	| 'superseded';

/** Outcome of a refresh attempt. */
export type LexiconRefreshResult =
	| { readonly ok: true; readonly index: LexiconIndex }
	| {
			readonly ok: false;
			readonly reason: LexiconRefreshFailure;
			readonly issues?: readonly LexiconParseIssue[];
	  };

/**
 * Computes the lowercase hex SHA-256 of a UTF-8 string.
 *
 * @param value Text to digest.
 * @return The digest, or null where Web Crypto is unavailable.
 */
export const sha256Hex = async (value: string): Promise<string | null> => {
	const subtle = (
		globalThis as {
			crypto?: {
				subtle?: {
					digest?: (
						algorithm: string,
						data: BufferSource
					) => Promise<ArrayBuffer>;
				};
			};
		}
	).crypto?.subtle;

	if (
		typeof subtle?.digest !== 'function' ||
		typeof TextEncoder !== 'function'
	) {
		return null;
	}

	try {
		const bytes = new TextEncoder().encode(value);
		const digest = await subtle.digest('SHA-256', bytes);

		return Array.from(new Uint8Array(digest))
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	} catch {
		return null;
	}
};

/**
 * An approved lexicon held locally, refreshed by revision.
 *
 * Instances hold at most one indexed lexicon per language. The index is built
 * lazily on first use so that opening a product with a large cached lexicon
 * does not pay the indexing cost until something actually asks a question.
 */
export class LexiconCache {
	private readonly store: LexiconStore;

	private readonly indexes = new Map<string, LexiconIndex>();

	/**
	 * Per-language refresh counter.
	 *
	 * Two refreshes for one language can complete out of order, and without
	 * this the earlier-requested artifact would overwrite the revision the
	 * later one already installed. A refresh that is no longer the current one
	 * for its language declines to install.
	 */
	private readonly refreshGenerations = new Map<string, number>();

	/**
	 * @param store Consumer-provided storage.
	 */
	public constructor(store: LexiconStore) {
		this.store = store;
	}

	/**
	 * Returns the cached index for a language, loading it from storage once.
	 *
	 * A cached artifact that no longer parses is DISCARDED rather than
	 * retained: it cannot answer a lookup, and keeping it would make every
	 * subsequent load pay to fail.
	 *
	 * @param language Language identifier.
	 * @return The index, or null when nothing usable is cached.
	 */
	public async load(language: string): Promise<LexiconIndex | null> {
		const existing = this.indexes.get(language);

		if (existing !== undefined) {
			return existing;
		}

		let artifact: string | null = null;

		try {
			artifact = await this.store.read(language);
		} catch {
			// Storage failure must not break writing. Treated as "nothing
			// cached", which degrades to no spelling assistance, not an error.
			return null;
		}

		if (artifact === null) {
			return null;
		}

		const parsed = parseSpellLexicon(artifact);

		// The same language check `refresh` applies, applied on the way in too:
		// a store entry written under the wrong key would otherwise annotate
		// one language's candidates against another language's lexicon, and its
		// opaque revision could make a later refresh report "unchanged".
		if (!parsed.ok || parsed.lexicon.language !== language) {
			try {
				await this.store.remove(language);
			} catch {
				// Best effort. A store that will not delete is still readable.
			}

			return null;
		}

		const index = new LexiconIndex(parsed.lexicon);

		this.indexes.set(language, index);

		return index;
	}

	/** The revision currently held for a language, or null. */
	public revisionOf(language: string): string | null {
		return this.indexes.get(language)?.revision ?? null;
	}

	/**
	 * Installs a new revision when the manifest names one this cache lacks.
	 *
	 * Order matters and is deliberate: check the revision BEFORE fetching, so
	 * an unchanged lexicon costs no bandwidth at all; verify the checksum
	 * BEFORE parsing, so a corrupted download is rejected on its bytes; and
	 * replace the stored copy only after the payload has both verified and
	 * parsed, so a failed refresh always leaves the previous working lexicon
	 * intact.
	 *
	 * @param entry   What the manifest says about this language.
	 * @param fetcher Consumer-provided fetch.
	 * @param signal  Abort signal.
	 * @return The installed index, or why nothing was installed.
	 */
	public async refresh(
		entry: LexiconManifestEntry,
		fetcher: LexiconFetcher,
		signal?: AbortSignal
	): Promise<LexiconRefreshResult> {
		const generation = (this.refreshGenerations.get(entry.language) ?? 0) + 1;

		this.refreshGenerations.set(entry.language, generation);

		/** Whether this refresh is still the newest one for its language. */
		const isCurrent = (): boolean =>
			this.refreshGenerations.get(entry.language) === generation;

		const current = await this.load(entry.language);

		if (current !== null && current.revision === entry.revision) {
			return { ok: false, reason: 'unchanged' };
		}

		let artifact: string;

		try {
			artifact = await fetcher(entry, signal);
		} catch {
			return { ok: false, reason: 'fetch-failed' };
		}

		const digest = await sha256Hex(artifact);

		if (digest === null) {
			// Fail CLOSED. Installing an unverifiable artifact would replace a
			// known-good lexicon with one nothing has vouched for.
			return { ok: false, reason: 'checksum-unavailable' };
		}

		if (digest !== entry.sha256.toLowerCase()) {
			return { ok: false, reason: 'checksum-mismatch' };
		}

		const parsed = parseSpellLexicon(artifact);

		if (!parsed.ok) {
			return {
				ok: false,
				reason: 'invalid-payload',
				issues: parsed.issues,
			};
		}

		// The artifact must agree with the manifest about what it is. A
		// mismatch means the two were published out of step, and trusting
		// either one over the other would be a guess.
		if (parsed.lexicon.revision !== entry.revision) {
			return { ok: false, reason: 'revision-mismatch' };
		}

		if (parsed.lexicon.language !== entry.language) {
			return { ok: false, reason: 'revision-mismatch' };
		}

		// A newer refresh for this language finished while this one was
		// fetching. Installing now would roll the cache back to an older
		// revision, so this one stands down.
		if (!isCurrent()) {
			return { ok: false, reason: 'superseded' };
		}

		try {
			await this.store.write(entry.language, artifact);
		} catch {
			// The lexicon is good and usable this session even if it cannot be
			// persisted; the next session simply re-downloads it.
		}

		const index = new LexiconIndex(parsed.lexicon);

		this.indexes.set(entry.language, index);

		return { ok: true, index };
	}

	/**
	 * Drops a language from the cache and from storage.
	 *
	 * @param language Language identifier.
	 */
	public async evict(language: string): Promise<void> {
		this.indexes.delete(language);
		// Invalidate any refresh in flight, so it cannot reinstate what this
		// call just removed.
		this.refreshGenerations.set(
			language,
			(this.refreshGenerations.get(language) ?? 0) + 1
		);

		try {
			await this.store.remove(language);
		} catch {
			// Best effort.
		}
	}
}

/**
 * An in-memory {@link LexiconStore}, for tests and for products with no
 * persistent storage available.
 *
 * Exported rather than kept private because a product running in a private
 * browsing context genuinely has nowhere to persist, and needs a store that
 * works for the session rather than a store that throws.
 */
export class MemoryLexiconStore implements LexiconStore {
	private readonly entries = new Map<string, string>();

	public readonly read = async (language: string): Promise<string | null> =>
		this.entries.get(language) ?? null;

	public readonly write = async (
		language: string,
		artifact: string
	): Promise<void> => {
		this.entries.set(language, artifact);
	};

	public readonly remove = async (language: string): Promise<void> => {
		this.entries.delete(language);
	};
}

/**
 * Parses a publisher manifest into the entries this cache understands.
 *
 * Unknown languages and malformed rows are SKIPPED rather than failing the
 * whole manifest: a publisher adding a language this build does not know about
 * must not stop it refreshing the languages it does.
 *
 * @param input JSON text or a parsed object with a `languages` array.
 * @return The entries that were well-formed.
 */
export const readLexiconManifest = (
	input: unknown
): readonly LexiconManifestEntry[] => {
	let raw: unknown = input;

	if (typeof input === 'string') {
		try {
			raw = JSON.parse(input);
		} catch {
			return [];
		}
	}

	if (typeof raw !== 'object' || raw === null) {
		return [];
	}

	const languages = (raw as { languages?: unknown }).languages;

	if (!Array.isArray(languages)) {
		return [];
	}

	const entries: LexiconManifestEntry[] = [];

	for (const row of languages) {
		if (typeof row !== 'object' || row === null) {
			continue;
		}

		const candidate = row as Record<string, unknown>;

		if (
			typeof candidate.language !== 'string' ||
			candidate.language === '' ||
			typeof candidate.revision !== 'string' ||
			candidate.revision === '' ||
			typeof candidate.sha256 !== 'string' ||
			!/^[0-9a-fA-F]{64}$/.test(candidate.sha256) ||
			typeof candidate.entryCount !== 'number' ||
			!Number.isFinite(candidate.entryCount) ||
			typeof candidate.sizeBytes !== 'number' ||
			!Number.isFinite(candidate.sizeBytes)
		) {
			continue;
		}

		entries.push({
			language: candidate.language,
			revision: candidate.revision,
			sha256: candidate.sha256.toLowerCase(),
			entryCount: candidate.entryCount,
			sizeBytes: candidate.sizeBytes,
		});
	}

	return entries;
};
