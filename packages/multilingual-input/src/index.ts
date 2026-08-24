/**
 * Aggregate entry point for 3iAtlas multilingual input.
 *
 * Consumers that want a single dependency import this package; consumers that
 * ship only Helper mode should depend on `core` and `adapters` directly so the
 * Keyman and React surfaces stay out of their bundle (section 9).
 */

export * as core from '@starisian/3iatlas-multilingual-input-core';
export * as adapters from '@starisian/3iatlas-multilingual-input-adapters';
export * as keyman from '@starisian/3iatlas-multilingual-input-keyman';
export * as profiles from '@starisian/3iatlas-multilingual-input-profiles';
