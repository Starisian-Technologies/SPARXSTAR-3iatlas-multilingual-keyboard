/**
 * The approved-lexicon contract, as this toolkit consumes it.
 *
 * The lexicon is PUBLISHED by the Dictionary, from approved entries only. This
 * package neither builds it, edits it, nor writes back to it — it validates
 * what it is handed and refuses anything that does not fit the contract.
 *
 * ONE HOME FOR THIS FACT. These types are the toolkit's single definition of
 * the compact-lexicon shape. A consumer must not re-declare them, and this
 * file must be reconciled against the Dictionary's published JSON Schema
 * rather than the reverse — the publisher owns the shape, this is the reader.
 *
 * VERIFY BEFORE WIRING UP: at the time this was written the publishing side
 * was still being built, so `SPELL_LEXICON_SCHEMA_VERSION` records which
 * contract version this reader implements. A mismatch is refused loudly rather
 * than parsed optimistically, because a half-read lexicon reports approved
 * words as unknown and would push writers toward the "not listed" path for
 * words the Dictionary already carries.
 *
 * Unicode is preserved exactly. Nothing here decomposes, case-folds, strips
 * diacritics, shortens a doubled vowel, or splits a digraph.
 */

/** The compact-lexicon contract version this reader implements. */
export const SPELL_LEXICON_SCHEMA_VERSION = 1;

/**
 * Publication state of an entry.
 *
 * `withdrawn` entries are carried so a cached lexicon can retire a word it
 * previously offered. A withdrawn word is never suggested, and is never
 * reported as approved.
 */
export type LexiconEntryStatus = 'approved' | 'withdrawn';

/** One approved word and its accepted spellings. */
export interface LexiconEntry {
	/** Stable public identifier minted by the Dictionary. */
	readonly id: string;
	/**
	 * The canonical approved spelling, verbatim.
	 *
	 * Exact code points. A doubled vowel stays doubled; `ŋ` stays `ŋ`.
	 */
	readonly headword: string;
	/**
	 * Accepted alternative spellings, verbatim.
	 *
	 * These are not errors to be corrected toward the headword. An accepted
	 * regional spelling is as approved as the headword, and confirming one
	 * inserts that spelling, not the headword.
	 */
	readonly variants: readonly string[];
	readonly status: LexiconEntryStatus;
}

/** A published lexicon for one language at one revision. */
export interface SpellLexicon {
	readonly schemaVersion: typeof SPELL_LEXICON_SCHEMA_VERSION;
	/** Language identifier exactly as the Dictionary publishes it. */
	readonly language: string;
	/**
	 * Opaque revision identifier for this language's artifact.
	 *
	 * Compared for equality only. Never parsed, ordered, or reasoned about:
	 * the publisher owns its format, and a reader that infers ordering from it
	 * will eventually be wrong about which of two revisions is newer.
	 */
	readonly revision: string;
	/** Orthography identifier, when the publisher records one. */
	readonly orthography: string | null;
	/** ISO 8601 generation time, for display in diagnostics. */
	readonly generatedAt: string;
	readonly entries: readonly LexiconEntry[];
}

/** Why a lexicon payload was refused. */
export interface LexiconParseIssue {
	readonly path: string;
	readonly message: string;
}

/** Outcome of validating a lexicon payload. */
export type LexiconParseResult =
	| { readonly ok: true; readonly lexicon: SpellLexicon }
	| { readonly ok: false; readonly issues: readonly LexiconParseIssue[] };

/** Statuses this contract version accepts. */
const STATUSES: readonly LexiconEntryStatus[] = ['approved', 'withdrawn'];

/**
 * Reports whether text is already in NFC.
 *
 * Used to REJECT, never to repair. NFC is the platform's canonical form for
 * language data, so a lexicon that arrives in another form is a publishing
 * fault: silently normalizing it here would hide that fault and, on some
 * orthographies, change which letters the writer sees.
 *
 * @param value Text to test.
 * @return True when normalizing would not change the text.
 */
export const isNfc = (value: string): boolean =>
	value.normalize('NFC') === value;

/**
 * Validates an untrusted lexicon payload.
 *
 * @param input JSON text, or an already-parsed object.
 * @return The lexicon, or the reasons it was refused.
 */
export const parseSpellLexicon = (input: unknown): LexiconParseResult => {
	let raw: unknown = input;

	if (typeof input === 'string') {
		try {
			raw = JSON.parse(input);
		} catch {
			return {
				ok: false,
				issues: [{ path: '', message: 'Input is not valid JSON.' }],
			};
		}
	}

	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return {
			ok: false,
			issues: [{ path: '', message: 'Expected a lexicon object.' }],
		};
	}

	const candidate = raw as Record<string, unknown>;

	if (candidate.schemaVersion !== SPELL_LEXICON_SCHEMA_VERSION) {
		return {
			ok: false,
			issues: [
				{
					path: 'schemaVersion',
					message:
						`Unsupported lexicon schema version ${String(
							candidate.schemaVersion
						)}. ` +
						`This build reads version ${SPELL_LEXICON_SCHEMA_VERSION} only.`,
				},
			],
		};
	}

	const issues: LexiconParseIssue[] = [];

	const text = (value: unknown, path: string): string | null => {
		if (typeof value !== 'string' || value === '') {
			issues.push({ path, message: 'Expected a non-empty string.' });

			return null;
		}

		return value;
	};

	const language = text(candidate.language, 'language');
	const revision = text(candidate.revision, 'revision');
	const generatedAt = text(candidate.generatedAt, 'generatedAt');

	if (
		candidate.orthography !== null &&
		typeof candidate.orthography !== 'string'
	) {
		issues.push({
			path: 'orthography',
			message: 'Expected a string or null.',
		});
	}

	if (!Array.isArray(candidate.entries)) {
		issues.push({ path: 'entries', message: 'Expected an array.' });

		return { ok: false, issues };
	}

	const entries: LexiconEntry[] = [];
	const seenIds = new Set<string>();

	candidate.entries.forEach((rawEntry, index) => {
		const path = `entries[${index}]`;

		if (typeof rawEntry !== 'object' || rawEntry === null) {
			issues.push({ path, message: 'Expected an object.' });

			return;
		}

		const entry = rawEntry as Record<string, unknown>;
		const id = text(entry.id, `${path}.id`);
		const headword = text(entry.headword, `${path}.headword`);

		if (!STATUSES.includes(entry.status as LexiconEntryStatus)) {
			issues.push({
				path: `${path}.status`,
				message: `Expected one of: ${STATUSES.join(', ')}.`,
			});
		}

		if (headword !== null && !isNfc(headword)) {
			issues.push({
				path: `${path}.headword`,
				message:
					'Headword is not in NFC. Refusing rather than normalizing, ' +
					'because normalizing here would change published language data.',
			});
		}

		if (!Array.isArray(entry.variants)) {
			issues.push({ path: `${path}.variants`, message: 'Expected an array.' });

			return;
		}

		const variants: string[] = [];

		entry.variants.forEach((rawVariant, variantIndex) => {
			const variantPath = `${path}.variants[${variantIndex}]`;
			const variant = text(rawVariant, variantPath);

			if (variant === null) {
				return;
			}

			if (!isNfc(variant)) {
				issues.push({
					path: variantPath,
					message:
						'Variant is not in NFC. Refusing rather than normalizing, ' +
						'because normalizing here would change published language data.',
				});

				return;
			}

			variants.push(variant);
		});

		if (id === null || headword === null) {
			return;
		}

		if (seenIds.has(id)) {
			issues.push({
				path: `${path}.id`,
				message: `Duplicate entry id "${id}".`,
			});

			return;
		}

		seenIds.add(id);
		entries.push({
			id,
			headword,
			variants,
			status: entry.status as LexiconEntryStatus,
		});
	});

	if (
		language === null ||
		revision === null ||
		generatedAt === null ||
		issues.length > 0
	) {
		return { ok: false, issues };
	}

	return {
		ok: true,
		lexicon: {
			schemaVersion: SPELL_LEXICON_SCHEMA_VERSION,
			language,
			revision,
			orthography:
				typeof candidate.orthography === 'string'
					? candidate.orthography
					: null,
			generatedAt,
			entries,
		},
	};
};

/** A word found in the lexicon. */
export interface LexiconMatch {
	readonly entryId: string;
	/** The exact approved spelling that matched — headword OR variant. */
	readonly matchedForm: string;
	/** True when the match was the canonical headword rather than a variant. */
	readonly isHeadword: boolean;
}

/**
 * An index over a lexicon, for exact-form lookup.
 *
 * Built once per revision and reused, because a recognition round asks about
 * several candidates and a linear scan of thousands of entries per candidate
 * is the kind of work that stalls a low-end phone mid-stroke.
 */
export class LexiconIndex {
	public readonly revision: string;

	public readonly language: string;

	private readonly byForm = new Map<string, LexiconMatch>();

	/**
	 * @param lexicon Validated lexicon to index.
	 */
	public constructor(lexicon: SpellLexicon) {
		this.revision = lexicon.revision;
		this.language = lexicon.language;

		for (const entry of lexicon.entries) {
			// A withdrawn word is not an approved word. It is indexed nowhere,
			// so it can never be offered or reported as approved.
			if (entry.status !== 'approved') {
				continue;
			}

			this.byForm.set(entry.headword, {
				entryId: entry.id,
				matchedForm: entry.headword,
				isHeadword: true,
			});

			for (const variant of entry.variants) {
				// The headword wins a collision: it is the canonical spelling.
				if (this.byForm.has(variant)) {
					continue;
				}

				this.byForm.set(variant, {
					entryId: entry.id,
					matchedForm: variant,
					isHeadword: false,
				});
			}
		}
	}

	/** How many approved forms are indexed, headwords and variants together. */
	public get size(): number {
		return this.byForm.size;
	}

	/**
	 * Looks a form up by exact code points.
	 *
	 * Exact, deliberately. No case folding, no diacritic stripping, no
	 * decomposition: two Mandinka words that differ only by a diacritic are
	 * different words, and a lookup that conflated them would be the first
	 * step toward silently replacing one with the other.
	 *
	 * @param form Text to look up.
	 * @return The match, or null when the lexicon does not carry this form.
	 */
	public lookup(form: string): LexiconMatch | null {
		return this.byForm.get(form) ?? null;
	}
}
