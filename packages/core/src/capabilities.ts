/**
 * Runtime capability detection.
 *
 * Specification section 5.1 places capability detection in core. Detection is
 * feature-based rather than user-agent based, and every probe degrades to a
 * safe answer so that a restricted environment never blocks typing.
 */

/** What the current runtime can do. */
export interface RuntimeCapabilities {
	/** `Intl.Segmenter` is available for grapheme-aware cursor movement. */
	readonly graphemeSegmentation: boolean;
	/** A DOM is present, so helper-bar rendering is possible. */
	readonly dom: boolean;
	/** The environment reports coarse (touch) pointer input. */
	readonly touch: boolean;
	/** The user asked for reduced motion (section 11). */
	readonly reducedMotion: boolean;
}

/**
 * Probes the current runtime.
 *
 * @return The detected capabilities.
 */
export const detectCapabilities = (): RuntimeCapabilities => {
	const hasDom =
		typeof globalThis !== 'undefined' &&
		typeof (globalThis as { document?: unknown }).document === 'object' &&
		(globalThis as { document?: unknown }).document !== null;

	const matchMedia = (
		globalThis as {
			matchMedia?: (query: string) => { matches: boolean };
		}
	).matchMedia;

	const probe = (query: string): boolean => {
		if (typeof matchMedia !== 'function') {
			return false;
		}

		try {
			return matchMedia(query).matches;
		} catch {
			return false;
		}
	};

	return {
		graphemeSegmentation:
			typeof (Intl as { Segmenter?: unknown }).Segmenter === 'function',
		dom: hasDom,
		touch: probe('(pointer: coarse)'),
		reducedMotion: probe('(prefers-reduced-motion: reduce)'),
	};
};
