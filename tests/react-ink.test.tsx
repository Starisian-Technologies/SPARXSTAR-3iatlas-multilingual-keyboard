/**
 * React bindings for ink and suggestions.
 *
 * jsdom has no canvas renderer, which is exactly the environment these tests
 * want: they check that the component tree, the accessible names, and the
 * confirmation flow are right, and that mounting a drawing surface where
 * drawing is impossible does not throw. Stroke rendering itself is covered by
 * the unit tests over the renderer and by the browser suite.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import type { InkDocument } from '@starisian/3iatlas-input-ink';
import { createInkDocument } from '@starisian/3iatlas-input-ink';
import type { SuggestionSet } from '@starisian/3iatlas-input-recognition';
import {
	InkCanvas,
	RecognitionSuggestions,
} from '@starisian/3iatlas-multilingual-input-react';
import type {
	InkToolbarLabels,
	RecognitionLabels,
} from '@starisian/3iatlas-multilingual-input-react';

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
	unavailable: (reason) => `Suggestions unavailable (${reason}).`,
	noCandidates: 'No suggestions.',
};

const DOCUMENT: InkDocument = createInkDocument({
	widthPx: 400,
	heightPx: 200,
	dpr: 1,
});

/**
 * Builds a suggestion set.
 *
 * @param overrides Fields to replace.
 * @return The set.
 */
const suggestions = (
	overrides: Partial<SuggestionSet> = {}
): SuggestionSet => ({
	inkDocumentId: DOCUMENT.id,
	strokeIds: ['s1'],
	candidates: [
		{
			id: 'c0',
			text: 'kuŋo',
			confidence: 0.9,
			inApprovedLexicon: true,
			lexiconEntryId: 'e1',
		},
		{
			id: 'c1',
			text: 'kingo',
			confidence: 0.4,
			inApprovedLexicon: false,
			lexiconEntryId: null,
		},
	],
	failure: null,
	lexiconRevision: 'rev-1',
	...overrides,
});

describe('InkCanvas', () => {
	it('mounts without a canvas renderer and exposes an accessible toolbar', () => {
		render(<InkCanvas labels={TOOLBAR_LABELS} />);

		expect(
			screen.getByRole('toolbar', { name: 'Handwriting area' })
		).toBeDefined();
		expect(screen.getByRole('button', { name: 'Pen' })).toBeDefined();
	});

	it('reports the selected tool with aria-pressed, not colour alone', () => {
		render(<InkCanvas labels={TOOLBAR_LABELS} />);

		const highlighter = screen.getByRole('button', { name: 'Highlighter' });

		expect(highlighter.getAttribute('aria-pressed')).toBe('false');

		fireEvent.click(highlighter);

		expect(highlighter.getAttribute('aria-pressed')).toBe('true');
		expect(
			screen.getByRole('button', { name: 'Pen' }).getAttribute('aria-pressed')
		).toBe('false');
	});

	it('disables undo and redo until there is something to undo', () => {
		render(<InkCanvas labels={TOOLBAR_LABELS} />);

		expect(
			(screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement)
				.disabled
		).toBe(true);
		expect(
			(screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement)
				.disabled
		).toBe(true);
	});

	it('asks before clearing, and does not clear when the writer declines', () => {
		const onReady = jest.fn();

		render(<InkCanvas labels={TOOLBAR_LABELS} onReady={onReady} />);

		fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

		expect(screen.getByRole('alertdialog')).toBeDefined();
		expect(
			screen.getByText('Clear everything you have written?')
		).toBeDefined();

		fireEvent.click(screen.getByRole('button', { name: 'Keep my writing' }));

		expect(screen.queryByRole('alertdialog')).toBeNull();
	});

	it('hands the surface handle to the consumer and takes it back on unmount', () => {
		const onReady = jest.fn();
		const { unmount } = render(
			<InkCanvas labels={TOOLBAR_LABELS} onReady={onReady} />
		);

		expect(onReady).toHaveBeenCalledTimes(1);
		expect(onReady.mock.calls[0]?.[0]).not.toBeNull();

		unmount();

		expect(onReady).toHaveBeenLastCalledWith(null);
	});
});

describe('RecognitionSuggestions', () => {
	it('renders nothing before a round has run', () => {
		const { container } = render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={null}
				onConfirmCandidate={jest.fn()}
				onConfirmOwnSpelling={jest.fn()}
			/>
		);

		expect(container.firstChild).toBeNull();
	});

	it('shows the handwriting beside the proposed readings', () => {
		render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={suggestions()}
				onConfirmCandidate={jest.fn()}
				onConfirmOwnSpelling={jest.fn()}
			/>
		);

		expect(screen.getByTestId('recognition-ink').innerHTML).toContain('<svg');
		expect(screen.getByTestId('candidate-c0').textContent).toBe('kuŋo');
	});

	it('labels lexicon status in text rather than by colour', () => {
		render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={suggestions()}
				onConfirmCandidate={jest.fn()}
				onConfirmOwnSpelling={jest.fn()}
			/>
		);

		expect(screen.getByText('in the dictionary')).toBeDefined();
		expect(screen.getByText('not in the dictionary')).toBeDefined();
	});

	it('still offers the unapproved candidate rather than hiding it', () => {
		render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={suggestions()}
				onConfirmCandidate={jest.fn()}
				onConfirmOwnSpelling={jest.fn()}
			/>
		);

		expect(screen.getByTestId('candidate-c1').textContent).toBe('kingo');
		expect(screen.getAllByRole('button', { name: 'Use this' })).toHaveLength(2);
	});

	it('inserts nothing until a person presses a button', () => {
		const onConfirmCandidate = jest.fn();

		render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={suggestions()}
				onConfirmCandidate={onConfirmCandidate}
				onConfirmOwnSpelling={jest.fn()}
			/>
		);

		// Rendering a suggestion is not accepting it. There is no
		// highest-confidence default and no timeout that picks one.
		expect(onConfirmCandidate).not.toHaveBeenCalled();

		fireEvent.click(screen.getAllByRole('button', { name: 'Use this' })[0]!);

		expect(onConfirmCandidate).toHaveBeenCalledWith('c0');
	});

	it('offers the word-not-listed path and keeps the writer spelling', () => {
		const onConfirmOwnSpelling = jest.fn();

		render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={suggestions()}
				onConfirmCandidate={jest.fn()}
				onConfirmOwnSpelling={onConfirmOwnSpelling}
			/>
		);

		fireEvent.click(screen.getByTestId('not-listed'));
		fireEvent.change(screen.getByTestId('own-spelling'), {
			target: { value: 'kuŋooba' },
		});
		fireEvent.click(screen.getByTestId('keep-my-spelling'));

		// Kept, and NOT submitted: keeping your own spelling and offering it
		// for review are separate decisions.
		expect(onConfirmOwnSpelling).toHaveBeenCalledWith('kuŋooba', false);
	});

	it('submits for review only when the writer asks for that', () => {
		const onConfirmOwnSpelling = jest.fn();

		render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={suggestions()}
				onConfirmCandidate={jest.fn()}
				onConfirmOwnSpelling={onConfirmOwnSpelling}
			/>
		);

		fireEvent.click(screen.getByTestId('not-listed'));
		fireEvent.change(screen.getByTestId('own-spelling'), {
			target: { value: 'kuŋooba' },
		});
		fireEvent.click(screen.getByTestId('submit-for-review'));

		expect(onConfirmOwnSpelling).toHaveBeenCalledWith('kuŋooba', true);
	});

	it('explains why suggestions are unavailable instead of showing nothing', () => {
		render(
			<RecognitionSuggestions
				labels={RECOGNITION_LABELS}
				document={DOCUMENT}
				suggestions={suggestions({ candidates: [], failure: 'offline' })}
				onConfirmCandidate={jest.fn()}
				onConfirmOwnSpelling={jest.fn()}
			/>
		);

		expect(screen.getByTestId('recognition-unavailable').textContent).toBe(
			'Suggestions unavailable (offline).'
		);
		// The writer can still record what they wrote.
		expect(screen.getByTestId('not-listed')).toBeDefined();
	});
});
