/**
 * Versioned digital-ink record.
 *
 * The vector strokes are the evidence. A flattened image is a rendering of
 * that evidence and can always be regenerated from it; the reverse is not
 * true, so this schema — not a PNG — is what a consumer persists.
 *
 * Specification section 10 governs what may be recorded: this is the writer's
 * own document content, held in the consuming product's storage, never
 * transmitted by this package. Nothing here is telemetry.
 *
 * `schemaVersion` is a hard gate rather than a hint. A reader that does not
 * recognize the version refuses the document instead of guessing at fields,
 * because a half-understood stroke set silently loses handwriting the writer
 * believes is saved.
 */

/** The only schema version this package writes, and the only one it reads. */
export const INK_SCHEMA_VERSION = 1;

/** Which physical device produced a stroke. */
export type InkPointerType = 'pen' | 'touch' | 'mouse' | 'unknown';

/** Which drawing tool produced a stroke. */
export type InkToolType = 'pen' | 'highlighter';

/**
 * One sampled point along a stroke.
 *
 * `pressure` is the browser's reported value in the range 0..1. A device that
 * reports no pressure is recorded as {@link NO_PRESSURE} rather than being
 * given a fabricated value, so a later reader can tell a genuinely light
 * stroke from a mouse that has no pressure to report at all.
 *
 * `t` is milliseconds since the stroke started, not a wall-clock timestamp:
 * it keeps the record small, makes it independent of the device clock, and
 * carries no information about when the writer was awake.
 */
export interface InkPoint {
	readonly x: number;
	readonly y: number;
	readonly pressure: number;
	readonly t: number;
}

/**
 * The pressure value recorded for a device that reports none.
 *
 * The Pointer Events specification has mouse and unsupported devices report
 * `0.5` for a pressed button, which is indistinguishable from a real
 * mid-pressure pen sample. This package substitutes an out-of-band marker so
 * that "no pressure data" survives serialization as a fact.
 */
export const NO_PRESSURE = -1;

/** A single captured stroke. */
export interface InkStroke {
	/** Stable identifier. Survives serialization; links ink to transcription. */
	readonly id: string;
	readonly tool: InkToolType;
	readonly pointerType: InkPointerType;
	/** CSS colour the stroke was drawn in. */
	readonly color: string;
	/** Base stroke width in CSS pixels, before pressure is applied. */
	readonly sizePx: number;
	/** Opacity 0..1. Highlighter strokes are translucent; pen strokes are not. */
	readonly opacity: number;
	/** Epoch milliseconds at which the stroke began. */
	readonly startedAt: number;
	readonly points: readonly InkPoint[];
}

/** The surface the strokes were drawn on, in CSS pixels. */
export interface InkCanvasSize {
	readonly widthPx: number;
	readonly heightPx: number;
	/** Device pixel ratio at capture time, for faithful re-rasterization. */
	readonly dpr: number;
}

/** A complete ink document. */
export interface InkDocument {
	readonly schemaVersion: typeof INK_SCHEMA_VERSION;
	/** Stable identifier. Links this ink to its confirmed transcriptions. */
	readonly id: string;
	/** ISO 8601 creation time. */
	readonly createdAt: string;
	/** ISO 8601 time of the last accepted edit. */
	readonly updatedAt: string;
	/**
	 * Canvas size the coordinates are expressed in.
	 *
	 * Coordinates are stored in this space and re-scaled on load, so resizing
	 * the canvas never rewrites the captured points (section 7's rule about
	 * not mutating captured data applies to ink as much as to text).
	 */
	readonly canvas: InkCanvasSize;
	readonly strokes: readonly InkStroke[];
}

/**
 * Generates an identifier for a stroke or document.
 *
 * Prefers `crypto.randomUUID`. The fallback is deliberately NOT
 * `Math.random()` alone dressed up as a UUID: it is a clearly-marked local
 * identifier, so nobody downstream mistakes it for a globally unique value.
 *
 * @param prefix Short tag describing what is being identified.
 * @return A new identifier.
 */
export const createInkId = (prefix: string): string => {
	const cryptoApi = (
		globalThis as {
			crypto?: { randomUUID?: () => string };
		}
	).crypto;

	if (typeof cryptoApi?.randomUUID === 'function') {
		try {
			return `${prefix}_${cryptoApi.randomUUID()}`;
		} catch {
			// Fall through to the local identifier below.
		}
	}

	const random = Math.random().toString(36).slice(2, 10);

	return `${prefix}_local_${Date.now().toString(36)}_${random}`;
};

/**
 * Creates an empty ink document.
 *
 * @param canvas Size of the surface the writer will draw on.
 * @param now    Injected clock, so tests are deterministic.
 * @return A new, empty document.
 */
export const createInkDocument = (
	canvas: InkCanvasSize,
	now: () => Date = () => new Date()
): InkDocument => {
	const timestamp = now().toISOString();

	return {
		schemaVersion: INK_SCHEMA_VERSION,
		id: createInkId('ink'),
		createdAt: timestamp,
		updatedAt: timestamp,
		canvas,
		strokes: [],
	};
};

/**
 * Reports whether a stroke carries real pressure data.
 *
 * @param stroke Stroke to inspect.
 * @return True when at least one point has a device-reported pressure.
 */
export const hasPressureData = (stroke: InkStroke): boolean =>
	stroke.points.some((point) => point.pressure !== NO_PRESSURE);
