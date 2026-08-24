import {
	insertAtSelection,
	normalizeInputText,
	validateLanguageProfile,
} from '../../src/ts/core';
import { MANDINKA_PROFILE } from '../../src/ts/profiles';

describe( 'core insertion behavior', () => {
	test( 'replaces selected text and moves caret to inserted character boundary', () => {
		const result = insertAtSelection(
			{
				value: 'N ka taa',
				selectionStart: 2,
				selectionEnd: 4,
			},
			'ñ'
		);

		expect( result.value ).toBe( 'N ñ taa' );
		expect( result.selectionStart ).toBe( 3 );
		expect( result.selectionEnd ).toBe( 3 );
	} );

	test( 'inserts at a collapsed caret without removing text', () => {
		const result = insertAtSelection(
			{
				value: 'ka taa',
				selectionStart: 0,
				selectionEnd: 0,
			},
			'ŋ'
		);

		expect( result.value ).toBe( 'ŋka taa' );
		expect( result.selectionStart ).toBe( 1 );
	} );

	test( 'normalizes text in configured normalization form', () => {
		const decomposed = 'é';
		expect( normalizeInputText( decomposed, 'NFC' ) ).toBe( 'é' );
	} );

	test( 'rejects a profile with a blank identifier', () => {
		expect(
			validateLanguageProfile( { ...MANDINKA_PROFILE, id: '' } )
		).toBe( false );
	} );
} );
