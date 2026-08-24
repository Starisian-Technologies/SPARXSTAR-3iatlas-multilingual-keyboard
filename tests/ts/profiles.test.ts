import { validateLanguageProfile } from '../../src/ts/core';
import { MANDINKA_PROFILE, RELEASE_ONE_PROFILES } from '../../src/ts/profiles';

describe( 'language profile validation', () => {
	test( 'accepts release one profiles with helper character groups', () => {
		for ( const profile of RELEASE_ONE_PROFILES ) {
			expect( validateLanguageProfile( profile ) ).toBe( true );
		}
	} );

	test( 'requires helper character groups', () => {
		expect(
			validateLanguageProfile( {
				...MANDINKA_PROFILE,
				helperCharacterGroups: [],
			} )
		).toBe( false );
	} );

	test( 'requires every group to carry characters', () => {
		expect(
			validateLanguageProfile( {
				...MANDINKA_PROFILE,
				helperCharacterGroups: [ { label: 'Empty', characters: [] } ],
			} )
		).toBe( false );
	} );
} );
