import type { LanguageProfile } from '@starisian/3iatlas-multilingual-input-core';

export const MANDINKA_PROFILE: LanguageProfile = {
  id: 'mandinka-latn-gm',
  bcp47Tag: 'mnk-Latn-GM',
  displayName: 'Mandinka',
  autonym: 'Mandinka',
  direction: 'ltr',
  normalizationForm: 'NFC',
  helperCharacterGroups: [
    { label: 'Vowels with diacritics', characters: ['á', 'à', 'é', 'è', 'í', 'ì', 'ó', 'ò', 'ú', 'ù'] },
  ],
};

export const WOLOF_PROFILE: LanguageProfile = {
  id: 'wolof-latn-sn',
  bcp47Tag: 'wo-Latn-SN',
  displayName: 'Wolof',
  autonym: 'Wolof',
  direction: 'ltr',
  normalizationForm: 'NFC',
  helperCharacterGroups: [
    { label: 'Extended letters', characters: ['ñ', 'ŋ', 'à', 'é', 'ë', 'ó'] },
  ],
};

export const FULA_PROFILE: LanguageProfile = {
  id: 'fula-latn-sn',
  bcp47Tag: 'ff-Latn-SN',
  displayName: 'Fula',
  autonym: 'Fulfulde',
  direction: 'ltr',
  normalizationForm: 'NFC',
  helperCharacterGroups: [{ label: 'Extended letters', characters: ['ɓ', 'ɗ', 'ƴ', 'ñ', 'ŋ'] }],
};

export const RELEASE_ONE_PROFILES: readonly LanguageProfile[] = [
  MANDINKA_PROFILE,
  WOLOF_PROFILE,
  FULA_PROFILE,
];
