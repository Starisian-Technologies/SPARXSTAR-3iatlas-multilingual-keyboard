/**
 * Aggregate entry point for the 3iAtlas Input Toolkit.
 *
 * Consumers that want a single dependency import this package; consumers that
 * ship only Helper mode should depend on `core` and `adapters` directly so the
 * Keyman, React, and ink surfaces stay out of their bundle (section 9).
 *
 * BACKWARD COMPATIBILITY: the `core`, `adapters`, `keyman`, and `profiles`
 * namespaces are unchanged, and every symbol they carried is still exported
 * from the same place. `ink`, `recognition`, the toolkit facade, and the DOM
 * helper bar are additions.
 */

export * as core from '@starisian/3iatlas-multilingual-input-core';
export * as adapters from '@starisian/3iatlas-multilingual-input-adapters';
export * as keyman from '@starisian/3iatlas-multilingual-input-keyman';
export * as profiles from '@starisian/3iatlas-multilingual-input-profiles';
export * as ink from '@starisian/3iatlas-input-ink';
export * as recognition from '@starisian/3iatlas-input-recognition';

export type {
	InputSurfaceKind,
	InputToolkit,
	InputToolkitEvent,
	InputToolkitOptions,
	InputToolkitStatus,
} from './toolkit';
export { createInputToolkit } from './toolkit';

export type { HelperBarHandle, HelperBarOptions } from './helper-bar';
export { mountHelperBar } from './helper-bar';
