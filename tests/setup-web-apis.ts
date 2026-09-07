/**
 * Supplies the Web APIs jsdom omits but every target browser provides.
 *
 * jsdom ships no `crypto.subtle` and, depending on version, no `TextEncoder`
 * on the global. Real browsers have both — `crypto.subtle` on any secure
 * origin, which is where this toolkit runs. Polyfilling here keeps the tests
 * exercising the same code path production does, rather than the fail-closed
 * branch that exists for insecure contexts. That branch has its own test.
 *
 * Node's types are referenced explicitly here rather than globally:
 * `tsconfig.base.json` sets `types: []` so that no browser package can reach
 * for `process` or `Buffer` and still typecheck.
 */

/// <reference types="node" />
import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';

const target = globalThis as unknown as Record<string, unknown>;

if (typeof target.TextEncoder !== 'function') {
	target.TextEncoder = TextEncoder;
}

if (typeof target.TextDecoder !== 'function') {
	target.TextDecoder = TextDecoder;
}

const existing = target.crypto as { subtle?: unknown } | undefined;

if (existing === undefined) {
	target.crypto = webcrypto;
} else if (existing.subtle === undefined) {
	// jsdom defines a partial `crypto` (getRandomValues only) and marks it
	// non-writable, so the property is redefined rather than assigned.
	Object.defineProperty(target, 'crypto', {
		value: webcrypto,
		configurable: true,
		writable: true,
	});
}

/*
 * A NOTE ON THE CANVAS NOISE IN TEST OUTPUT.
 *
 * jsdom has no 2D renderer, so every ink surface mounted in a jsdom test logs
 * "Not implemented: HTMLCanvasElement.prototype.getContext". That is the
 * degradation path working: `mountInkSurface` gets a null context and skips
 * painting, and `detectCapabilities().canvas2d` is how a product finds out.
 *
 * It is left visible on purpose. Filtering it here does not work — jsdom's
 * virtual console holds its own console reference from before this file runs —
 * and stubbing `getContext` would make the tests stop exercising the very
 * branch that keeps a canvas-less environment working. Real rendering is
 * covered by the renderer unit tests and by the Playwright suite.
 */
