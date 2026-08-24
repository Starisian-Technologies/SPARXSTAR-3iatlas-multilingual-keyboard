/**
 * Framework-agnostic core for 3iAtlas multilingual input.
 *
 * Specification section 5.1: this module must not depend on React, a specific
 * editor, WordPress, RLC, or Identity Node. It has no runtime dependencies.
 */

export type {
	CaseRelationship,
	CombiningRule,
	LanguageProfile,
	NormalizationForm,
	ProfileApproval,
	ProfileApprovalStatus,
	ProfileCharacterGroup,
	ProfileFixture,
	ProfileFonts,
	ProfileKeymanBinding,
	ProfileProvenance,
	ProfileValidationIssue,
	ProfileValidationResult,
	TextDirection,
} from './profile';
export {
	isSupportedProfile,
	selectSupportedProfiles,
	validateLanguageProfile,
} from './profile';

export type { InsertResult, TextSelectionState } from './text';
export {
	insertAtSelection,
	nextGraphemeBoundary,
	normalizeInputText,
	previousGraphemeBoundary,
	toCodePoints,
	toGraphemes,
} from './text';

export type { InputMode } from './input-mode';
export { DEFAULT_INPUT_MODE, INPUT_MODES, parseInputMode } from './input-mode';

export type { EditorAdapter, InsertionRequest } from './adapter';
export { isEditorAdapter } from './adapter';

export type { PreferenceAdapter, PreferenceScope } from './preferences';
export {
	buildPreferenceKey,
	readInputModePreference,
	writeInputModePreference,
} from './preferences';

export type { RuntimeCapabilities } from './capabilities';
export { detectCapabilities } from './capabilities';
