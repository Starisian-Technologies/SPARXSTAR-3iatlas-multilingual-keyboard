/**
 * Keyman engine boundary.
 *
 * The concrete engine binding is a design decision that must be approved before
 * implementation, so the shipped default is an inert adapter that satisfies the
 * contract without loading or contacting anything.
 */

import type { LanguageProfile } from './core';

/** Lifecycle contract for a Keyman-backed input engine. */
export interface KeymanAdapter {
	readonly initialize: () => Promise< void >;
	readonly activateProfile: ( profile: LanguageProfile ) => Promise< void >;
	readonly teardown: () => Promise< void >;
}

/** Adapter that satisfies the contract and performs no work. */
export class NoopKeymanAdapter implements KeymanAdapter {
	public async initialize(): Promise< void > {
		return Promise.resolve();
	}

	public async activateProfile( profile: LanguageProfile ): Promise< void > {
		void profile;
		return Promise.resolve();
	}

	public async teardown(): Promise< void > {
		return Promise.resolve();
	}
}
