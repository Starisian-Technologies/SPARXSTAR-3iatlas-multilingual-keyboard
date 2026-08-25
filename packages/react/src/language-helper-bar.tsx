/**
 * Language helper bar.
 *
 * Specification section 6.3: shows only characters approved for the active
 * profile, keeps touch targets at least 44x44 CSS pixels, stays reachable by
 * keyboard and assistive technology, names each key accessibly with its
 * language context, inserts through the configured editor adapter, and never
 * reorders itself from captured user text.
 */

import { useState } from 'react';

import { useMultilingualInput } from './context';

/** Props accepted by {@link LanguageHelperBar}. */
export interface LanguageHelperBarProps {
	/** Accessible name for the toolbar. */
	readonly label: string;
	/** Localized label for the expand/collapse control. */
	readonly toggleLabel: string;
	/**
	 * Builds the accessible name for one character key.
	 *
	 * Defaults to the character itself. Consumers should supply a localized
	 * description, because a bare combining mark announces poorly.
	 */
	readonly describeCharacter?: (character: string, group: string) => string;
	/** Render collapsed initially. */
	readonly initiallyCollapsed?: boolean;
}

/** Minimum touch target required by section 6.3, in CSS pixels. */
const MINIMUM_TOUCH_TARGET_PX = 44;

/**
 * Renders the approved helper characters for the active profile.
 *
 * Character order follows the profile data exactly and is never re-sorted by
 * usage, which section 6.3 forbids without explicit consent.
 *
 * @param props Helper-bar configuration.
 * @return The helper bar, or null when there is no active profile.
 */
export const LanguageHelperBar = ({
	label,
	toggleLabel,
	describeCharacter,
	initiallyCollapsed = false,
}: LanguageHelperBarProps): JSX.Element | null => {
	const { activeProfile, insertCharacter } = useMultilingualInput();
	const [collapsed, setCollapsed] = useState(initiallyCollapsed);

	if (activeProfile === null) {
		return null;
	}

	const keyStyle = {
		minWidth: `${MINIMUM_TOUCH_TARGET_PX}px`,
		minHeight: `${MINIMUM_TOUCH_TARGET_PX}px`,
	};

	return (
		<div
			className="tiatlas-helper-bar"
			role="toolbar"
			aria-label={label}
			aria-orientation="horizontal"
			lang={activeProfile.bcp47Tag}
			dir={activeProfile.direction}
		>
			<button
				type="button"
				className="tiatlas-helper-bar__toggle"
				aria-expanded={!collapsed}
				onClick={() => setCollapsed((previous) => !previous)}
				style={keyStyle}
			>
				{toggleLabel}
			</button>
			{!collapsed &&
				activeProfile.helperCharacterGroups.map((group) => (
					<div
						key={group.label}
						className="tiatlas-helper-bar__group"
						role="group"
						aria-label={group.label}
					>
						{group.characters.map((character) => (
							<button
								key={character}
								type="button"
								className="tiatlas-helper-bar__key"
								style={keyStyle}
								aria-label={
									describeCharacter?.(character, group.label) ?? character
								}
								// Keep focus and selection in the writing
								// surface: pressing a helper key must insert
								// at the caret, not move focus to the key.
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => insertCharacter(character)}
							>
								{character}
							</button>
						))}
					</div>
				))}
		</div>
	);
};
