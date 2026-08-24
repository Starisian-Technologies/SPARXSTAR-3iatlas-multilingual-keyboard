import {
	ControlledReactInputAdapter,
	NativeTextareaAdapter,
	WordPadEditorAdapter,
} from '../../src/ts/adapters';

describe( 'editor adapters', () => {
	test( 'every adapter inserts through the shared selection helper', () => {
		const state = {
			value: 'be',
			selectionStart: 2,
			selectionEnd: 2,
		};

		for ( const adapter of [
			new NativeTextareaAdapter(),
			new ControlledReactInputAdapter(),
			new WordPadEditorAdapter(),
		] ) {
			const result = adapter.insertCharacter( state, 'ɗ' );

			expect( result.value ).toBe( 'beɗ' );
			expect( result.selectionStart ).toBe( 3 );
		}
	} );
} );
