import type { InputMode, LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

export interface MultilingualInputState {
  readonly activeProfileId: string;
  readonly inputMode: InputMode;
}

export interface MultilingualInputProviderProps {
  readonly profiles: readonly LanguageProfile[];
  readonly initialProfileId: string;
  readonly initialInputMode: InputMode;
}

export interface InputModeOption {
  readonly value: InputMode;
  readonly label: string;
}

export const INPUT_MODE_OPTIONS: readonly InputModeOption[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'helper', label: 'Helper' },
  { value: 'full-keyboard', label: 'Full keyboard' },
];
