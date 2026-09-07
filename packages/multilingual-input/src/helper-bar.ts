/**
 * Framework-agnostic helper-bar mount.
 *
 * The React binding in `@starisian/3iatlas-multilingual-input-react` is the
 * richer surface. This exists because the toolkit's consumers are not all
 * React: the Dictionary, the games, and a classroom page may be plain DOM, and
 * a shared input capability that only mounts inside one framework is not
 * shared.
 *
 * The two renderers duplicate no facts. The approved characters come from the
 * profile, the insertion rule comes from core, and the accessibility rules
 * come from the specification; only the markup differs, which is what a
 * binding is.
 *
 * Specification section 6.3 governs the behavior: approved characters only, at
 * least 44x44 CSS pixel targets, reachable by keyboard and assistive
 * technology, inserted through the editor adapter, and never reordered from
 * what the writer has typed.
 */

import type {
	EditorAdapter,
	LanguageProfile,
} from '@starisian/3iatlas-multilingual-input-core';
import { normalizeInputText } from '@starisian/3iatlas-multilingual-input-core';

/** Minimum touch target required by section 6.3, in CSS pixels. */
const MINIMUM_TOUCH_TARGET_PX = 44;

/** Options accepted by {@link mountHelperBar}. */
export interface HelperBarOptions {
	readonly profile: LanguageProfile;
	/** Adapter for the writing surface. Null disables insertion. */
	readonly adapter: EditorAdapter | null;
	/** Accessible name for the toolbar. */
	readonly label: string;
	/**
	 * Builds the accessible name for one key.
	 *
	 * Defaults to the character itself, which announces poorly for a bare
	 * combining mark; a consumer should supply a localized description.
	 */
	readonly describeCharacter?: (character: string, group: string) => string;
	/** Notified after a character is inserted. Receives no text (section 10). */
	readonly onInsert?: (profileId: string) => void;
}

/** Handle returned by {@link mountHelperBar}. */
export interface HelperBarHandle {
	/** Swaps the profile and re-renders the approved characters. */
	readonly setProfile: (profile: LanguageProfile) => void;
	/** Swaps the writing surface the bar inserts into. */
	readonly setAdapter: (adapter: EditorAdapter | null) => void;
	readonly destroy: () => void;
}

/**
 * Renders the approved helper characters for a profile into a host element.
 *
 * @param host    Element to render into. Existing children are left alone.
 * @param options Helper-bar configuration.
 * @return The handle.
 */
export const mountHelperBar = (
	host: HTMLElement,
	options: HelperBarOptions
): HelperBarHandle => {
	const ownerDocument = host.ownerDocument;
	const toolbar = ownerDocument.createElement('div');

	toolbar.className = 'tiatlas-helper-bar';
	toolbar.setAttribute('role', 'toolbar');
	toolbar.setAttribute('aria-label', options.label);
	toolbar.setAttribute('aria-orientation', 'horizontal');

	host.appendChild(toolbar);

	let profile = options.profile;
	let adapter = options.adapter;

	const insert = (character: string): void => {
		if (adapter === null) {
			return;
		}

		// Normalize to the profile's declared form at this documented
		// boundary (section 7) before the adapter sees the text.
		const text = normalizeInputText(character, profile.normalizationForm);

		// A consumer-supplied adapter is a runtime boundary. A rejected
		// insertion or a throwing adapter is a no-op, never a broken page.
		try {
			if (adapter.insert({ text, profileId: profile.id }) === null) {
				return;
			}

			adapter.restoreFocus();
		} catch {
			return;
		}

		options.onInsert?.(profile.id);
	};

	const render = (): void => {
		toolbar.textContent = '';
		toolbar.lang = profile.bcp47Tag;
		toolbar.dir = profile.direction;

		for (const group of profile.helperCharacterGroups) {
			const groupElement = ownerDocument.createElement('div');

			groupElement.className = 'tiatlas-helper-bar__group';
			groupElement.setAttribute('role', 'group');
			groupElement.setAttribute('aria-label', group.label);

			// Character order follows the profile exactly. Section 6.3 forbids
			// re-sorting it from what the writer has typed.
			for (const character of group.characters) {
				const key = ownerDocument.createElement('button');

				key.type = 'button';
				key.className = 'tiatlas-helper-bar__key';
				key.style.minWidth = `${MINIMUM_TOUCH_TARGET_PX}px`;
				key.style.minHeight = `${MINIMUM_TOUCH_TARGET_PX}px`;
				key.setAttribute(
					'aria-label',
					options.describeCharacter?.(character, group.label) ?? character
				);
				key.textContent = character;
				// Keep focus and selection in the writing surface: pressing a
				// key must insert at the caret, not move focus to the key.
				key.addEventListener('mousedown', (event) => event.preventDefault());
				key.addEventListener('click', () => insert(character));

				groupElement.appendChild(key);
			}

			toolbar.appendChild(groupElement);
		}
	};

	render();

	return {
		setProfile: (next) => {
			profile = next;
			render();
		},
		setAdapter: (next) => {
			adapter = next;
		},
		destroy: () => {
			toolbar.remove();
		},
	};
};
