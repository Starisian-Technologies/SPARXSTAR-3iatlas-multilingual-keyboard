/**
 * Lexicon caching: revision freshness, checksum verification, and the
 * fail-closed rules that protect a working cached lexicon.
 *
 * The failure mode these guard against is subtle and expensive: a corrupted or
 * mismatched download replacing a good lexicon, after which every approved
 * Mandinka word starts reading as "not listed" and writers are pushed to
 * submit words the Dictionary already carries.
 */

import { describe, expect, it, jest } from '@jest/globals';

import type {
	LexiconManifestEntry,
	SpellLexicon,
} from '@starisian/3iatlas-input-recognition';
import {
	SPELL_LEXICON_SCHEMA_VERSION,
	LexiconCache,
	MemoryLexiconStore,
	readLexiconManifest,
	sha256Hex,
} from '@starisian/3iatlas-input-recognition';

/**
 * Builds a lexicon artifact.
 *
 * @param revision Revision identifier.
 * @param words    Headwords to include.
 * @return The serialized artifact.
 */
const artifact = (revision: string, words: readonly string[]): string => {
	const lexicon: SpellLexicon = {
		schemaVersion: SPELL_LEXICON_SCHEMA_VERSION,
		language: 'mnk',
		revision,
		orthography: 'peace-corps-gm',
		generatedAt: '2026-09-01T00:00:00.000Z',
		entries: words.map((headword, index) => ({
			id: `e${index}`,
			headword,
			variants: [],
			status: 'approved' as const,
		})),
	};

	return JSON.stringify(lexicon);
};

/**
 * Builds a manifest entry describing an artifact.
 *
 * @param revision Revision identifier.
 * @param text     The artifact text.
 * @param overrides Fields to replace.
 * @return The entry.
 */
const manifestEntry = async (
	revision: string,
	text: string,
	overrides: Partial<LexiconManifestEntry> = {}
): Promise<LexiconManifestEntry> => ({
	language: 'mnk',
	revision,
	sha256: (await sha256Hex(text)) ?? '',
	entryCount: 1,
	sizeBytes: text.length,
	...overrides,
});

describe('digest', () => {
	it('computes a stable lowercase hex SHA-256', async () => {
		const digest = await sha256Hex('kuŋo');

		expect(digest).toMatch(/^[0-9a-f]{64}$/);
		expect(await sha256Hex('kuŋo')).toBe(digest);
	});

	it('distinguishes a decomposed spelling from a precomposed one', async () => {
		// Written as escapes, not as literal characters: an editor, a
		// clipboard, or a tool in the pipeline can silently normalize a
		// pasted decomposed sequence, and the test would then pass while
		// asserting nothing.
		const precomposed = '\u00F1';
		const decomposed = '\u006E\u0303';

		expect(precomposed).not.toBe(decomposed);
		expect(await sha256Hex(precomposed)).not.toBe(await sha256Hex(decomposed));
	});
});

describe('refreshing by revision', () => {
	it('installs a lexicon the cache does not have', async () => {
		const text = artifact('rev-1', ['kuŋo']);
		const cache = new LexiconCache(new MemoryLexiconStore());
		const result = await cache.refresh(
			await manifestEntry('rev-1', text),
			async () => text
		);

		expect(result.ok).toBe(true);
		expect(cache.revisionOf('mnk')).toBe('rev-1');
	});

	it('does not download again when the revision is unchanged', async () => {
		const text = artifact('rev-1', ['kuŋo']);
		const cache = new LexiconCache(new MemoryLexiconStore());
		const entry = await manifestEntry('rev-1', text);

		await cache.refresh(entry, async () => text);

		const fetcher = jest.fn(async () => text);
		const second = await cache.refresh(entry, fetcher);

		expect(second.ok).toBe(false);
		expect(second.ok === false && second.reason).toBe('unchanged');
		// Bandwidth is a cost on this platform, not a detail.
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('installs a new revision over an old one', async () => {
		const cache = new LexiconCache(new MemoryLexiconStore());
		const first = artifact('rev-1', ['kuŋo']);
		const second = artifact('rev-2', ['kuŋo', 'baa']);

		await cache.refresh(await manifestEntry('rev-1', first), async () => first);
		await cache.refresh(
			await manifestEntry('rev-2', second),
			async () => second
		);

		expect(cache.revisionOf('mnk')).toBe('rev-2');
		expect((await cache.load('mnk'))?.size).toBe(2);
	});
});

describe('a bad download never replaces a good lexicon', () => {
	it('refuses a checksum mismatch', async () => {
		const text = artifact('rev-2', ['kuŋo']);
		const cache = new LexiconCache(new MemoryLexiconStore());
		const result = await cache.refresh(
			await manifestEntry('rev-2', text, { sha256: 'f'.repeat(64) }),
			async () => text
		);

		expect(result.ok === false && result.reason).toBe('checksum-mismatch');
		expect(cache.revisionOf('mnk')).toBeNull();
	});

	it('refuses a truncated download, which fails on its bytes', async () => {
		const text = artifact('rev-2', ['kuŋo']);
		const cache = new LexiconCache(new MemoryLexiconStore());
		const result = await cache.refresh(
			await manifestEntry('rev-2', text),
			async () => text.slice(0, text.length - 20)
		);

		expect(result.ok === false && result.reason).toBe('checksum-mismatch');
	});

	it('refuses an artifact whose revision disagrees with the manifest', async () => {
		const text = artifact('rev-OTHER', ['kuŋo']);
		const cache = new LexiconCache(new MemoryLexiconStore());
		const result = await cache.refresh(
			await manifestEntry('rev-2', text),
			async () => text
		);

		expect(result.ok === false && result.reason).toBe('revision-mismatch');
	});

	it('refuses an artifact for a different language', async () => {
		const text = JSON.stringify({
			...JSON.parse(artifact('rev-2', ['kuŋo'])),
			language: 'wol',
		});
		const cache = new LexiconCache(new MemoryLexiconStore());
		const result = await cache.refresh(
			await manifestEntry('rev-2', text),
			async () => text
		);

		expect(result.ok === false && result.reason).toBe('revision-mismatch');
	});

	it('refuses a payload that does not satisfy the schema', async () => {
		const text = '{"schemaVersion":1,"entries":"not an array"}';
		const cache = new LexiconCache(new MemoryLexiconStore());
		const result = await cache.refresh(
			await manifestEntry('rev-2', text),
			async () => text
		);

		expect(result.ok === false && result.reason).toBe('invalid-payload');
	});

	it('keeps the previous revision usable after a failed refresh', async () => {
		const cache = new LexiconCache(new MemoryLexiconStore());
		const good = artifact('rev-1', ['kuŋo']);

		await cache.refresh(await manifestEntry('rev-1', good), async () => good);
		await cache.refresh(
			await manifestEntry('rev-2', artifact('rev-2', ['baa']), {
				sha256: '0'.repeat(64),
			}),
			async () => artifact('rev-2', ['baa'])
		);

		expect(cache.revisionOf('mnk')).toBe('rev-1');
		expect((await cache.load('mnk'))?.lookup('kuŋo')).not.toBeNull();
	});

	it('refuses to install anything when the digest cannot be computed', async () => {
		// An insecure context has no `crypto.subtle`, so nothing can vouch for
		// the bytes. Failing CLOSED is the only safe answer: installing an
		// unverifiable artifact is how a good lexicon gets replaced by a bad one.
		const target = globalThis as unknown as Record<string, unknown>;
		const saved = target.crypto;

		Object.defineProperty(target, 'crypto', {
			value: { getRandomValues: () => undefined },
			configurable: true,
			writable: true,
		});

		try {
			const text = artifact('rev-1', ['ku\u014Bo']);
			const cache = new LexiconCache(new MemoryLexiconStore());
			const result = await cache.refresh(
				{
					language: 'mnk',
					revision: 'rev-1',
					sha256: 'a'.repeat(64),
					entryCount: 1,
					sizeBytes: text.length,
				},
				async () => text
			);

			expect(result.ok === false && result.reason).toBe('checksum-unavailable');
			expect(cache.revisionOf('mnk')).toBeNull();
		} finally {
			Object.defineProperty(target, 'crypto', {
				value: saved,
				configurable: true,
				writable: true,
			});
		}
	});

	it('reports a network failure without disturbing the cache', async () => {
		const cache = new LexiconCache(new MemoryLexiconStore());
		const result = await cache.refresh(
			await manifestEntry('rev-1', artifact('rev-1', ['kuŋo'])),
			async () => {
				throw new Error('offline');
			}
		);

		expect(result.ok === false && result.reason).toBe('fetch-failed');
	});
});

describe('cached storage', () => {
	it('reloads a stored lexicon in a later session', async () => {
		const store = new MemoryLexiconStore();
		const text = artifact('rev-1', ['kuŋo']);

		await new LexiconCache(store).refresh(
			await manifestEntry('rev-1', text),
			async () => text
		);

		// A fresh cache over the same store is the next session.
		const reopened = await new LexiconCache(store).load('mnk');

		expect(reopened?.revision).toBe('rev-1');
		expect(reopened?.lookup('kuŋo')?.entryId).toBe('e0');
	});

	it('discards a stored artifact that no longer parses', async () => {
		const store = new MemoryLexiconStore();

		await store.write('mnk', '{"schemaVersion":99}');

		const cache = new LexiconCache(store);

		expect(await cache.load('mnk')).toBeNull();
		expect(await store.read('mnk')).toBeNull();
	});

	it('treats a storage read failure as nothing cached', async () => {
		const cache = new LexiconCache({
			read: async () => {
				throw new Error('quota');
			},
			write: async () => undefined,
			remove: async () => undefined,
		});

		expect(await cache.load('mnk')).toBeNull();
	});

	it('still serves this session when the lexicon cannot be persisted', async () => {
		const text = artifact('rev-1', ['kuŋo']);
		const cache = new LexiconCache({
			read: async () => null,
			write: async () => {
				throw new Error('storage full');
			},
			remove: async () => undefined,
		});
		const result = await cache.refresh(
			await manifestEntry('rev-1', text),
			async () => text
		);

		expect(result.ok).toBe(true);
		expect(cache.revisionOf('mnk')).toBe('rev-1');
	});
});

describe('concurrent and mis-keyed artifacts', () => {
	it('does not let a slower refresh roll back a newer revision', async () => {
		const cache = new LexiconCache(new MemoryLexiconStore());
		const older = artifact('rev-1', ['kuŋo']);
		const newer = artifact('rev-2', ['kuŋo', 'baa']);
		let releaseOlder = (): void => undefined;
		const olderGate = new Promise<void>((resolve) => {
			releaseOlder = resolve;
		});

		const olderRefresh = cache.refresh(
			await manifestEntry('rev-1', older),
			async () => {
				await olderGate;

				return older;
			}
		);

		// The newer revision is requested second and lands first.
		await cache.refresh(await manifestEntry('rev-2', newer), async () => newer);

		releaseOlder();

		const result = await olderRefresh;

		expect(result.ok === false && result.reason).toBe('superseded');
		expect(cache.revisionOf('mnk')).toBe('rev-2');
	});

	it('discards a stored artifact filed under the wrong language', async () => {
		const store = new MemoryLexiconStore();

		// A Wolof artifact stored under the Mandinka key. Indexing it would
		// annotate Mandinka candidates against another language's lexicon.
		await store.write(
			'mnk',
			JSON.stringify({
				...JSON.parse(artifact('rev-1', ['kuŋo'])),
				language: 'wol',
			})
		);

		const cache = new LexiconCache(store);

		expect(await cache.load('mnk')).toBeNull();
		expect(await store.read('mnk')).toBeNull();
	});

	it('an eviction is not undone by a refresh already in flight', async () => {
		const cache = new LexiconCache(new MemoryLexiconStore());
		const text = artifact('rev-1', ['kuŋo']);
		let release = (): void => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		const pending = cache.refresh(
			await manifestEntry('rev-1', text),
			async () => {
				await gate;

				return text;
			}
		);

		await cache.evict('mnk');
		release();

		expect((await pending).ok).toBe(false);
		expect(cache.revisionOf('mnk')).toBeNull();
	});
});

describe('manifest reading', () => {
	it('reads well-formed rows', () => {
		const entries = readLexiconManifest({
			languages: [
				{
					language: 'mnk',
					revision: 'rev-1',
					sha256: 'A'.repeat(64),
					entryCount: 10,
					sizeBytes: 200,
				},
			],
		});

		expect(entries).toHaveLength(1);
		// Normalized to lowercase so a manifest's casing never causes a
		// spurious checksum mismatch.
		expect(entries[0]?.sha256).toBe('a'.repeat(64));
	});

	it('skips malformed rows rather than failing the whole manifest', () => {
		const entries = readLexiconManifest({
			languages: [
				{
					language: 'mnk',
					revision: 'r',
					sha256: 'nope',
					entryCount: 1,
					sizeBytes: 1,
				},
				{
					language: 'wol',
					revision: 'r2',
					sha256: 'b'.repeat(64),
					entryCount: 1,
					sizeBytes: 1,
				},
			],
		});

		expect(entries.map((entry) => entry.language)).toEqual(['wol']);
	});

	it('returns nothing for a manifest that is not JSON', () => {
		expect(readLexiconManifest('<html>')).toEqual([]);
	});

	it('returns nothing when the manifest has no languages array', () => {
		expect(readLexiconManifest({ ok: true })).toEqual([]);
	});
});
