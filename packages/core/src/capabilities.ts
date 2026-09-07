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
	/** Pointer Events are available, so digital ink can be captured. */
	readonly pointerEvents: boolean;
	/**
	 * `PointerEvent.getCoalescedEvents` is available.
	 *
	 * Without it, ink capture still works but samples a fast stroke at the
	 * frame rate rather than the device rate, so handwriting is slightly
	 * coarser. Reported so a product can say so rather than guess.
	 */
	readonly coalescedPointerEvents: boolean;
	/** A 2D canvas context can be created, so ink can be drawn. */
	readonly canvas2d: boolean;
	/** `ResizeObserver` is available, so an ink surface can follow its host. */
	readonly resizeObserver: boolean;
	/**
	 * Whether pen pressure is available.
	 *
	 * Always null. Pressure support is a property of the DEVICE currently in
	 * contact, not of the browser, and no API reports it before a stroke
	 * begins. A product that needs to know reads it from the captured stroke
	 * (`hasPressureData`), and this field exists to stop anyone inventing a
	 * probe that would confidently return the wrong answer.
	 */
	readonly pressure: null;
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

	const global = globalThis as {
		PointerEvent?: unknown;
		ResizeObserver?: unknown;
		HTMLCanvasElement?: unknown;
		document?: { createElement?: (tag: string) => unknown };
	};

	const hasPointerEvents = typeof global.PointerEvent === 'function';

	const hasCoalesced =
		hasPointerEvents &&
		typeof (global.PointerEvent as { prototype?: Record<string, unknown> })
			.prototype?.getCoalescedEvents === 'function';

	// Probed by actually asking for a context: jsdom and some restricted
	// embeddings define HTMLCanvasElement and then refuse to draw.
	const hasCanvas2d = ((): boolean => {
		if (!hasDom || typeof global.document?.createElement !== 'function') {
			return false;
		}

		try {
			const element = global.document.createElement('canvas') as {
				getContext?: (id: string) => unknown;
			};

			return typeof element.getContext === 'function'
				? element.getContext('2d') !== null
				: false;
		} catch {
			return false;
		}
	})();

	return {
		graphemeSegmentation:
			typeof (Intl as { Segmenter?: unknown }).Segmenter === 'function',
		dom: hasDom,
		touch: probe('(pointer: coarse)'),
		reducedMotion: probe('(prefers-reduced-motion: reduce)'),
		pointerEvents: hasPointerEvents,
		coalescedPointerEvents: hasCoalesced,
		canvas2d: hasCanvas2d,
		resizeObserver: typeof global.ResizeObserver === 'function',
		pressure: null,
	};
};
