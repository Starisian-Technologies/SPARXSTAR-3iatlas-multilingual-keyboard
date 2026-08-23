export type InputMode = 'standard' | 'helper' | 'full-keyboard';

export interface ProfileCharacterGroup {
  readonly label: string;
  readonly characters: readonly string[];
}

export interface LanguageProfile {
  readonly id: string;
  readonly bcp47Tag: string;
  readonly displayName: string;
  readonly autonym: string;
  readonly direction: 'ltr' | 'rtl';
  readonly normalizationForm: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  readonly helperCharacterGroups: readonly ProfileCharacterGroup[];
}

export interface TextSelectionState {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

export interface InsertResult {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

export const validateLanguageProfile = (profile: LanguageProfile): boolean => {
  if (profile.id === '' || profile.bcp47Tag === '') {
    return false;
  }

  if (profile.helperCharacterGroups.length === 0) {
    return false;
  }

  return profile.helperCharacterGroups.every((group) => group.characters.length > 0);
};

export const normalizeInputText = (
  input: string,
  normalizationForm: LanguageProfile['normalizationForm']
): string => input.normalize(normalizationForm);

export const insertAtSelection = (
  state: TextSelectionState,
  insertedText: string
): InsertResult => {
  const start = state.selectionStart;
  const end = state.selectionEnd;
  const value = `${state.value.slice(0, start)}${insertedText}${state.value.slice(end)}`;
  const nextSelection = start + insertedText.length;

  return {
    value,
    selectionStart: nextSelection,
    selectionEnd: nextSelection,
  };
};
