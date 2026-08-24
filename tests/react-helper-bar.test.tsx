import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import type { EditorAdapter } from '@starisian/3iatlas-multilingual-input-core';
import {
	LanguageHelperBar,
	MultilingualInputProvider,
} from '@starisian/3iatlas-multilingual-input-react';
import {
	FULA_SN_PROFILE,
	MANDINKA_GM_PROFILE,
} from '@starisian/3iatlas-multilingual-input-profiles';

const createAdapter = (): EditorAdapter & {
	inserted: string[];
	focusCount: number;
} => {
	const inserted: string[] = [];
	const adapter = {
		id: 'test-adapter',
		inserted,
		focusCount: 0,
		readSelection: () => ({
			value: '',
			selectionStart: 0,
			selectionEnd: 0,
		}),
		insert: (request: { text: string }) => {
			inserted.push(request.text);

			return {
				value: request.text,
				selectionStart: request.text.length,
				selectionEnd: request.text.length,
			};
		},
		restoreFocus: () => {
			adapter.focusCount += 1;
		},
	};

	return adapter;
};

describe('LanguageHelperBar', () => {
	test('renders only the active profile characters and inserts through the adapter', () => {
		const adapter = createAdapter();

		render(
			<MultilingualInputProvider profiles={[FULA_SN_PROFILE]} adapter={adapter}>
				<LanguageHelperBar label="Characters" toggleLabel="Toggle" />
			</MultilingualInputProvider>
		);

		fireEvent.click(screen.getByRole('button', { name: 'ɗ' }));

		expect(adapter.inserted).toEqual(['ɗ']);
		// Focus must return to the writing surface (section 6.3).
		expect(adapter.focusCount).toBeGreaterThan(0);
		// A character from another profile must not be offered.
		expect(screen.queryByRole('button', { name: 'á' })).toBeNull();
	});

	test('exposes language and direction context for assistive technology', () => {
		render(
			<MultilingualInputProvider
				profiles={[MANDINKA_GM_PROFILE]}
				adapter={createAdapter()}
			>
				<LanguageHelperBar label="Characters" toggleLabel="Toggle" />
			</MultilingualInputProvider>
		);

		const toolbar = screen.getByRole('toolbar', { name: 'Characters' });

		expect(toolbar.getAttribute('lang')).toBe('mnk-Latn-GM');
		expect(toolbar.getAttribute('dir')).toBe('ltr');
	});

	test('emits a non-content event carrying no typed text', () => {
		const onEvent = jest.fn();

		render(
			<MultilingualInputProvider
				profiles={[FULA_SN_PROFILE]}
				adapter={createAdapter()}
				onEvent={onEvent}
			>
				<LanguageHelperBar label="Characters" toggleLabel="Toggle" />
			</MultilingualInputProvider>
		);

		fireEvent.click(screen.getByRole('button', { name: 'ƴ' }));

		const event = onEvent.mock.calls.find(
			(call) => (call[0] as { type: string }).type === 'character-inserted'
		)?.[0];

		expect(event).toEqual({
			type: 'character-inserted',
			profileId: 'fula-latn-sn',
		});
		expect(JSON.stringify(event)).not.toContain('ƴ');
	});
});
