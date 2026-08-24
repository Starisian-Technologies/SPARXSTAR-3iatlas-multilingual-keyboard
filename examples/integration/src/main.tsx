/**
 * Integration example.
 *
 * Proves the package against the five host surfaces the specification names:
 * a native input, a textarea, a contenteditable surface, a controlled React
 * input, and the WordPad adapter boundary.
 *
 * The Keyman full keyboard is wired through the real adapter but no engine is
 * self-hosted here, so selecting it demonstrates the mandatory fallback to
 * Helper mode rather than a working on-screen keyboard.
 */

import { StrictMode, useCallback, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type {
	EditorAdapter,
	InsertResult,
	LanguageProfile,
	TextSelectionState,
} from '@starisian/3iatlas-multilingual-input-core';
import {
	describeValidationStatus,
	isLinguisticallyValidated,
	selectAvailableProfiles,
} from '@starisian/3iatlas-multilingual-input-core';
import {
	ContentEditableAdapter,
	ControlledReactInputAdapter,
	NativeTextControlAdapter,
	WordPadEditorAdapter,
} from '@starisian/3iatlas-multilingual-input-adapters';
import { ALL_PROFILES } from '@starisian/3iatlas-multilingual-input-profiles';
import {
	InputModeSelector,
	LanguageHelperBar,
	MultilingualInputProvider,
} from '@starisian/3iatlas-multilingual-input-react';

const MODE_LABELS = {
	standard: 'Standard',
	helper: 'Helper',
	'full-keyboard': 'Full keyboard',
} as const;

/** Banner stating the AiWA review state, rendered verbatim from core. */
const ValidationNotice = ({ profile }: { profile: LanguageProfile }) => (
	<p data-testid="validation-notice" className="notice">
		{describeValidationStatus(profile)}
		{!isLinguisticallyValidated(profile) && (
			<strong> Do not describe this language as AiWA-validated.</strong>
		)}
	</p>
);

/** One host surface plus the adapter that drives it. */
const Surface = ({
	title,
	testId,
	children,
}: {
	title: string;
	testId: string;
	children: React.ReactNode;
}) => (
	<section className="surface" data-testid={`surface-${testId}`}>
		<h2>{title}</h2>
		{children}
	</section>
);

const App = () => {
	const profiles = useMemo(() => selectAvailableProfiles(ALL_PROFILES), []);
	const [activeProfileId, setActiveProfileId] = useState(profiles[0]?.id ?? '');
	const activeProfile =
		profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

	// Elements live in state, not refs: a ref does not re-run the adapter
	// memo when the element mounts, which would leave the adapter null.
	const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);
	const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(
		null
	);
	const [editableEl, setEditableEl] = useState<HTMLDivElement | null>(null);
	const [controlledEl, setControlledEl] = useState<HTMLInputElement | null>(
		null
	);
	const [controlledValue, setControlledValue] = useState('');
	const [controlledSelection, setControlledSelection] = useState(0);
	// Surface 5: WordPad transaction boundary.
	const [wordPadValue, setWordPadValue] = useState('');
	const wordPadHistory = useRef<string[]>([]);

	const [target, setTarget] = useState('input');
	const [events, setEvents] = useState<string[]>([]);

	const adapter = useMemo<EditorAdapter | null>(() => {
		switch (target) {
			case 'input':
				return inputEl ? new NativeTextControlAdapter(inputEl) : null;
			case 'textarea':
				return textareaEl ? new NativeTextControlAdapter(textareaEl) : null;
			case 'contenteditable':
				return editableEl ? new ContentEditableAdapter(editableEl) : null;
			case 'controlled':
				return new ControlledReactInputAdapter(
					(): TextSelectionState | null => ({
						value: controlledValue,
						selectionStart: controlledEl?.selectionStart ?? controlledSelection,
						selectionEnd: controlledEl?.selectionEnd ?? controlledSelection,
					}),
					(result: InsertResult) => {
						setControlledValue(result.value);
						setControlledSelection(result.selectionStart);
					},
					() => controlledEl?.focus()
				);
			case 'wordpad':
				return new WordPadEditorAdapter({
					getSelection: () => ({
						value: wordPadValue,
						selectionStart: wordPadValue.length,
						selectionEnd: wordPadValue.length,
					}),
					applyInsertion: (text: string) => {
						// A transaction: one undoable history entry.
						wordPadHistory.current.push(wordPadValue);

						const next = wordPadValue + text;

						setWordPadValue(next);

						return {
							value: next,
							selectionStart: next.length,
							selectionEnd: next.length,
						};
					},
					focus: () => undefined,
				});
			default:
				return null;
		}
	}, [
		target,
		inputEl,
		textareaEl,
		editableEl,
		controlledEl,
		controlledValue,
		controlledSelection,
		wordPadValue,
	]);

	const onEvent = useCallback((event: { type: string }) => {
		// Only the event type is recorded — never typed text (section 10).
		setEvents((previous) => [...previous, event.type].slice(-8));
	}, []);

	if (activeProfile === null) {
		return <p>No available language profiles.</p>;
	}

	return (
		<main>
			<h1>3iAtlas Multilingual Input</h1>

			<label>
				Language{' '}
				<select
					data-testid="profile-select"
					value={activeProfileId}
					onChange={(e) => setActiveProfileId(e.target.value)}
				>
					{profiles.map((p) => (
						<option key={p.id} value={p.id}>
							{p.displayName}
						</option>
					))}
				</select>
			</label>

			<ValidationNotice profile={activeProfile} />

			<label>
				Target surface{' '}
				<select
					data-testid="target-select"
					value={target}
					onChange={(e) => setTarget(e.target.value)}
				>
					<option value="input">Native input</option>
					<option value="textarea">Textarea</option>
					<option value="contenteditable">Contenteditable</option>
					<option value="controlled">Controlled React input</option>
					<option value="wordpad">WordPad adapter</option>
				</select>
			</label>

			<MultilingualInputProvider
				profiles={[activeProfile]}
				adapter={adapter}
				onEvent={onEvent}
			>
				<InputModeSelector labels={MODE_LABELS} legend="Input mode" />
				<LanguageHelperBar
					label="Language characters"
					toggleLabel="Characters"
					describeCharacter={(character) => `Insert ${character}`}
				/>
			</MultilingualInputProvider>

			<Surface title="Native input" testId="input">
				<input ref={setInputEl} data-testid="native-input" />
			</Surface>

			<Surface title="Textarea" testId="textarea">
				<textarea ref={setTextareaEl} data-testid="native-textarea" />
			</Surface>

			<Surface title="Contenteditable" testId="contenteditable">
				<div
					ref={setEditableEl}
					data-testid="contenteditable"
					contentEditable
					suppressContentEditableWarning
				/>
			</Surface>

			<Surface title="Controlled React input" testId="controlled">
				<input
					ref={setControlledEl}
					data-testid="controlled-input"
					value={controlledValue}
					onChange={(e) => setControlledValue(e.target.value)}
				/>
			</Surface>

			<Surface title="WordPad adapter boundary" testId="wordpad">
				<div data-testid="wordpad-output">{wordPadValue}</div>
				<p>Transactions: {wordPadHistory.current.length}</p>
			</Surface>

			<section>
				<h2>Lifecycle events</h2>
				<ul data-testid="events">
					{events.map((type, index) => (
						<li key={`${type}-${index}`}>{type}</li>
					))}
				</ul>
			</section>
		</main>
	);
};

const container = document.getElementById('root');

if (container !== null) {
	createRoot(container).render(
		<StrictMode>
			<App />
		</StrictMode>
	);
}
