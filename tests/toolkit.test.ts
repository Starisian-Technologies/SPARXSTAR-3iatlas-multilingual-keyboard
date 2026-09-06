/**
 * The toolkit facade, and the backward-compatibility guarantee.
 *
 * The compatibility half matters as much as the new behavior: existing
 * keyboard consumers must not have to change a line, so every symbol the
 * package exported before the ink work has to still be exported from the same
 * place, with the same shape.
 */

import { describe, expect, it, jest } from '@jest/globals';

import type {
	EditorAdapter,
	InsertResult,
	TextSelectionState,
} from '@starisian/3iatlas-multilingual-input-core';
import { insertAtSelection } from '@starisian/3iatlas-multilingual-input-core';
import { MANDINKA_GM_PROFILE } from '@starisian/3iatlas-multilingual-input-profiles';
import type { SpellLexicon } from '@starisian/3iatlas-input-recognition';
import type { InputToolkitEvent } from '@starisian/3iatlas-multilingual-input';
import {
	adapters,
	core,
	createInputToolkit,
	ink,
	keyman,
	mountHelperBar,
	profiles,
	recognition,
} from '@starisian/3iatlas-multilingual-input';

/** A minimal in-memory writing surface. */
class FakeEditor implements EditorAdapter {
	public readonly id = 'fake';

	public value = '';

	public focusCount = 0;

	public readonly readSelection = (): TextSelectionState | null => ({
		value: this.value,
		selectionStart: this.value.length,
		selectionEnd: this.value.length,
	});

	public readonly insert = (request: { text: string }): InsertResult | null => {
		const state = this.readSelection();

		if (state === null) {
			return null;
		}

		const result = insertAtSelection(state, request.text);

		this.value = result.value;

		return result;
	};

	public readonly restoreFocus = (): void => {
		this.focusCount += 1;
	};
}

const LEXICON: SpellLexicon = {
	schemaVersion: recognition.SPELL_LEXICON_SCHEMA_VERSION,
	language: 'mnk',
	revision: 'rev-3',
	orthography: 'peace-corps-gm',
	generatedAt: '2026-09-01T00:00:00.000Z',
	entries: [{ id: 'e1', headword: 'kuŋo', variants: [], status: 'approved' }],
};

describe('backward compatibility for existing keyboard consumers', () => {
	it('still exposes the original namespaces', () => {
		expect(typeof core.detectCapabilities).toBe('function');
		expect(typeof core.insertAtSelection).toBe('function');
		expect(typeof core.validateLanguageProfile).toBe('function');
		expect(typeof adapters.NativeTextControlAdapter).toBe('function');
		expect(typeof keyman.checkKeymanEligibility).toBe('function');
		expect(Array.isArray(profiles.ALL_PROFILES)).toBe(true);
	});

	it('adds the ink and recognition namespaces without disturbing the others', () => {
		expect(typeof ink.mountInkSurface).toBe('function');
		expect(typeof recognition.RecognitionSession).toBe('function');
	});

	it('keeps the capability report a superset of what it was', () => {
		const capabilities = core.detectCapabilities();

		// The four original fields are unchanged in name and type.
		expect(typeof capabilities.graphemeSegmentation).toBe('boolean');
		expect(typeof capabilities.dom).toBe('boolean');
		expect(typeof capabilities.touch).toBe('boolean');
		expect(typeof capabilities.reducedMotion).toBe('boolean');
	});

	it('reports pressure as unknowable rather than inventing a probe', () => {
		// No browser API answers "will the next stroke carry pressure". A
		// confident boolean here would be a fabricated one.
		expect(core.detectCapabilities().pressure).toBeNull();
	});
});

describe('the keyboard path through the facade', () => {
	it('inserts an approved character at the caret and restores focus', () => {
		const editor = new FakeEditor();
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			adapter: editor,
		});

		editor.value = 'baa';

		expect(toolkit.insertCharacter('ŋ')).toBe(true);
		expect(editor.value).toBe('baaŋ');
		expect(editor.focusCount).toBe(1);

		toolkit.destroy();
	});

	it('reports a rejected insertion rather than claiming success', () => {
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			adapter: {
				id: 'refusing',
				readSelection: () => null,
				insert: () => null,
				restoreFocus: () => undefined,
			},
		});

		expect(toolkit.insertCharacter('ŋ')).toBe(false);

		toolkit.destroy();
	});

	it('survives an adapter that throws', () => {
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			adapter: {
				id: 'broken',
				readSelection: () => null,
				insert: () => {
					throw new Error('editor exploded');
				},
				restoreFocus: () => undefined,
			},
		});

		expect(toolkit.insertCharacter('ŋ')).toBe(false);

		toolkit.destroy();
	});

	it('switches profile and mode, emitting non-content events only', () => {
		const events: InputToolkitEvent[] = [];
		const toolkit = createInputToolkit({
			profiles: profiles.ALL_PROFILES,
			onEvent: (event) => events.push(event),
		});

		toolkit.setInputMode('full-keyboard');
		toolkit.setActiveProfileId('wolof-latn-sn');

		expect(events).toEqual([
			{ type: 'mode-changed', mode: 'full-keyboard' },
			{ type: 'profile-changed', profileId: 'wolof-latn-sn' },
		]);

		toolkit.destroy();
	});

	it('ignores a profile the product does not ship', () => {
		const toolkit = createInputToolkit({ profiles: [MANDINKA_GM_PROFILE] });

		toolkit.setActiveProfileId('not-shipped');

		expect(toolkit.getActiveProfile()?.id).toBe(MANDINKA_GM_PROFILE.id);

		toolkit.destroy();
	});
});

describe('surface switching', () => {
	it('reports the active surface and emits on change', () => {
		const events: InputToolkitEvent[] = [];
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			onEvent: (event) => events.push(event),
		});

		expect(toolkit.getActiveSurface()).toBe('keyboard');

		toolkit.setActiveSurface('pencil');

		expect(toolkit.getActiveSurface()).toBe('pencil');
		expect(events).toEqual([{ type: 'surface-changed', surface: 'pencil' }]);

		// Setting the same surface again is not a change.
		toolkit.setActiveSurface('pencil');

		expect(events).toHaveLength(1);

		toolkit.destroy();
	});
});

describe('status reporting', () => {
	it('reports recognition as unavailable when none is configured', () => {
		const toolkit = createInputToolkit({ profiles: [MANDINKA_GM_PROFILE] });
		const status = toolkit.readStatus();

		expect(status.recognitionAvailable).toBe(false);
		expect(status.lexiconRevision).toBeNull();
		expect(status.activeProfileId).toBe(MANDINKA_GM_PROFILE.id);

		toolkit.destroy();
	});

	it('reports the lexicon revision once one is supplied', () => {
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			lexicon: new recognition.LexiconIndex(LEXICON),
		});

		expect(toolkit.readStatus().lexiconRevision).toBe('rev-3');

		toolkit.destroy();
	});

	it('reports connectivity without gating anything on it', () => {
		const toolkit = createInputToolkit({ profiles: [MANDINKA_GM_PROFILE] });
		const status = toolkit.readStatus();

		expect(
			status.connectivity.online === null ||
				typeof status.connectivity.online === 'boolean'
		).toBe(true);

		toolkit.destroy();
	});
});

describe('confirmed text reaches the editor verbatim', () => {
	it('inserts the confirmed transcription without normalizing it', () => {
		const editor = new FakeEditor();
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			adapter: editor,
			lexicon: new recognition.LexiconIndex(LEXICON),
		});
		const transcription = toolkit.confirmTypedText(
			{ inkDocumentId: 'ink_1', strokeIds: ['s1'] },
			'kuŋo'
		);

		expect(toolkit.insertTranscription(transcription)).toBe(true);
		expect(editor.value).toBe('kuŋo');
		expect(Array.from(editor.value)).toEqual(['k', 'u', 'ŋ', 'o']);

		toolkit.destroy();
	});

	it('inserts a decomposed spelling unchanged rather than composing it', () => {
		// The writer confirmed these exact code points. Composing them here
		// would be the silent normalization the toolkit forbids.
		// Escapes, not a literal: a pasted decomposed sequence can be
		// normalized by an editor or a tool, and the test would then assert
		// nothing.
		const decomposed = 'ba\u006E\u0303o';
		const editor = new FakeEditor();
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			adapter: editor,
		});
		const transcription = toolkit.confirmTypedText(
			{ inkDocumentId: 'ink_1', strokeIds: ['s1'] },
			decomposed
		);

		toolkit.insertTranscription(transcription);

		expect(editor.value).toBe(decomposed);
		expect(editor.value.normalize('NFC')).not.toBe(editor.value);

		toolkit.destroy();
	});

	it('emits a confirmation event carrying no text', () => {
		const events: InputToolkitEvent[] = [];
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			onEvent: (event) => events.push(event),
		});

		toolkit.confirmTypedText(
			{ inkDocumentId: 'ink_1', strokeIds: ['s1'] },
			'kuŋooba'
		);

		expect(events).toEqual([
			{
				type: 'text-confirmed',
				source: 'not-listed',
				inApprovedLexicon: false,
			},
		]);
		// Section 10: no event may carry the writer's content.
		expect(JSON.stringify(events)).not.toContain('kuŋooba');

		toolkit.destroy();
	});

	it('survives an onEvent handler that throws', () => {
		const toolkit = createInputToolkit({
			profiles: [MANDINKA_GM_PROFILE],
			onEvent: () => {
				throw new Error('telemetry down');
			},
		});

		expect(() => toolkit.setInputMode('standard')).not.toThrow();

		toolkit.destroy();
	});
});

describe('recognition through the facade with nothing mounted', () => {
	it('returns null rather than throwing when there is no ink surface', async () => {
		const toolkit = createInputToolkit({ profiles: [MANDINKA_GM_PROFILE] });

		expect(await toolkit.requestRecognition()).toBeNull();
		expect(toolkit.serializeInk()).toBeNull();
		expect(toolkit.restoreInk('{}')).toBe(false);

		toolkit.destroy();
	});
});

describe('the framework-agnostic helper bar', () => {
	it('renders the approved characters and inserts through the adapter', () => {
		const editor = new FakeEditor();
		const host = document.createElement('div');

		document.body.appendChild(host);

		const bar = mountHelperBar(host, {
			profile: MANDINKA_GM_PROFILE,
			adapter: editor,
			label: 'Language characters',
		});

		const keys = Array.from(host.querySelectorAll('button'));
		const eng = keys.find((key) => key.textContent === 'ŋ');

		expect(eng).toBeDefined();
		expect(host.querySelector('[role="toolbar"]')).not.toBeNull();

		eng?.click();

		expect(editor.value).toBe('ŋ');

		bar.destroy();
		host.remove();
	});

	it('meets the 44px touch-target rule on every key', () => {
		const host = document.createElement('div');
		const bar = mountHelperBar(host, {
			profile: MANDINKA_GM_PROFILE,
			adapter: null,
			label: 'Language characters',
		});

		for (const key of Array.from(host.querySelectorAll('button'))) {
			expect(key.style.minWidth).toBe('44px');
			expect(key.style.minHeight).toBe('44px');
		}

		bar.destroy();
	});

	it('keeps the profile order rather than re-sorting it', () => {
		const host = document.createElement('div');
		const bar = mountHelperBar(host, {
			profile: MANDINKA_GM_PROFILE,
			adapter: null,
			label: 'Language characters',
		});
		const rendered = Array.from(host.querySelectorAll('button')).map(
			(key) => key.textContent
		);
		const expected = MANDINKA_GM_PROFILE.helperCharacterGroups.flatMap(
			(group) => [...group.characters]
		);

		expect(rendered).toEqual(expected);

		bar.destroy();
	});

	it('does nothing when no adapter is attached', () => {
		const host = document.createElement('div');
		const onInsert = jest.fn();
		const bar = mountHelperBar(host, {
			profile: MANDINKA_GM_PROFILE,
			adapter: null,
			label: 'Language characters',
			onInsert,
		});

		host.querySelector('button')?.click();

		expect(onInsert).not.toHaveBeenCalled();

		bar.destroy();
	});
});
