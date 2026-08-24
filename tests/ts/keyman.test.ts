import { NoopKeymanAdapter } from '../../src/ts/keyman';
import { MANDINKA_PROFILE } from '../../src/ts/profiles';

describe( 'noop keyman adapter', () => {
	test( 'satisfies the lifecycle contract without performing work', async () => {
		const adapter = new NoopKeymanAdapter();

		await expect( adapter.initialize() ).resolves.toBeUndefined();
		await expect(
			adapter.activateProfile( MANDINKA_PROFILE )
		).resolves.toBeUndefined();
		await expect( adapter.teardown() ).resolves.toBeUndefined();
	} );
} );
