import { validateLanguageProfile } from '@starisian/3iatlas-multilingual-input-core';
import { MANDINKA_PROFILE, RELEASE_ONE_PROFILES } from '@starisian/3iatlas-multilingual-input-profiles';

describe('language profile validation', () => {
  test('accepts release one profiles with helper character groups', () => {
    for (const profile of RELEASE_ONE_PROFILES) {
      expect(validateLanguageProfile(profile)).toBe(true);
    }
  });

  test('requires helper character groups', () => {
    expect(
      validateLanguageProfile({
        ...MANDINKA_PROFILE,
        helperCharacterGroups: [],
      })
    ).toBe(false);
  });
});
