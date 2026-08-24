import { getInputModeOptions } from '../../src/ts/input-mode';

describe( 'input mode options', () => {
	test( 'exposes the three supported modes in order', () => {
		expect(
			getInputModeOptions().map( ( option ) => option.value )
		).toEqual( [ 'standard', 'helper', 'full-keyboard' ] );
	} );

	test( 'labels every option', () => {
		for ( const option of getInputModeOptions() ) {
			expect( option.label.length ).toBeGreaterThan( 0 );
		}
	} );
} );
