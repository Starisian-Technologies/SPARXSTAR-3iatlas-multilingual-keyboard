/**
 * Ink serialization and strict parsing.
 *
 * Round-tripping handwriting is the whole reason the vector record exists, so
 * the reader is deliberately unforgiving. A document that is damaged,
 * truncated, or written by a newer schema is REFUSED with a reason rather
 * than partially repaired: silently dropping the strokes it could not read
 * would hand the writer a document that looks saved and is not.
 *
 * Everything parsed here is untrusted input (specification section 10), even
 * when it came from the product's own storage — storage corrupts, and a
 * synchronized document may have been written by a different version.
 */

import type {
	InkCanvasSize,
	InkDocument,
	InkPoint,
	InkPointerType,
	InkStroke,
	InkToolType,
} from './schema';
import { INK_SCHEMA_VERSION, NO_PRESSURE } from './schema';

/** Why a document could not be read. */
export interface InkParseIssue {
	/** Dotted path to the offending value, e.g. `strokes[2].points[7].x`. */
	readonly path: string;
	readonly message: string;
}

/** Outcome of parsing a serialized document. */
export type InkParseResult =
	| { readonly ok: true; readonly document: InkDocument }
	| { readonly ok: false; readonly issues: readonly InkParseIssue[] };

/** Pointer types this schema version accepts. */
const POINTER_TYPES: readonly InkPointerType[] = [
	'pen',
	'touch',
	'mouse',
	'unknown',
];

/** Tools this schema version accepts. */
const TOOL_TYPES: readonly InkToolType[] = ['pen', 'highlighter'];

/**
 * Serializes a document to JSON.
 *
 * @param document Document to write.
 * @return A JSON string.
 */
export const serializeInkDocument = (document: InkDocument): string =>
	JSON.stringify(document);

/** Collects issues while walking an untrusted object graph. */
class IssueLog {
	public readonly issues: InkParseIssue[] = [];

	/**
	 * Records a problem.
	 *
	 * @param path    Where the problem is.
	 * @param message What is wrong.
	 */
	public add(path: string, message: string): void {
		this.issues.push({ path, message });
	}

	/**
	 * Reads a finite number, recording an issue when the value is not one.
	 *
	 * `NaN` and `Infinity` are rejected rather than coerced: an infinite
	 * coordinate renders as nothing and would lose the stroke silently.
	 *
	 * @param value Candidate value.
	 * @param path  Where it came from.
	 * @return The number, or null when unusable.
	 */
	public finiteNumber(value: unknown, path: string): number | null {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			this.add(path, 'Expected a finite number.');

			return null;
		}

		return value;
	}

	/**
	 * Reads a non-empty string.
	 *
	 * @param value Candidate value.
	 * @param path  Where it came from.
	 * @return The string, or null when unusable.
	 */
	public text(value: unknown, path: string): string | null {
		if (typeof value !== 'string' || value === '') {
			this.add(path, 'Expected a non-empty string.');

			return null;
		}

		return value;
	}
}

/**
 * Reads one point.
 *
 * @param raw  Candidate point.
 * @param path Path for diagnostics.
 * @param log  Issue collector.
 * @return The point, or null when unusable.
 */
const readPoint = (
	raw: unknown,
	path: string,
	log: IssueLog
): InkPoint | null => {
	if (typeof raw !== 'object' || raw === null) {
		log.add(path, 'Expected an object.');

		return null;
	}

	const candidate = raw as Record<string, unknown>;
	const x = log.finiteNumber(candidate.x, `${path}.x`);
	const y = log.finiteNumber(candidate.y, `${path}.y`);
	const t = log.finiteNumber(candidate.t, `${path}.t`);
	const pressure = log.finiteNumber(candidate.pressure, `${path}.pressure`);

	if (x === null || y === null || t === null || pressure === null) {
		return null;
	}

	// Pressure is either the no-data marker or a 0..1 reading. Anything else
	// is a different scale, and guessing which would corrupt stroke width.
	if (pressure !== NO_PRESSURE && (pressure < 0 || pressure > 1)) {
		log.add(
			`${path}.pressure`,
			`Expected ${NO_PRESSURE} (no data) or a value between 0 and 1.`
		);

		return null;
	}

	return { x, y, t, pressure };
};

/**
 * Reads one stroke.
 *
 * @param raw  Candidate stroke.
 * @param path Path for diagnostics.
 * @param log  Issue collector.
 * @return The stroke, or null when unusable.
 */
const readStroke = (
	raw: unknown,
	path: string,
	log: IssueLog
): InkStroke | null => {
	if (typeof raw !== 'object' || raw === null) {
		log.add(path, 'Expected an object.');

		return null;
	}

	const candidate = raw as Record<string, unknown>;
	const id = log.text(candidate.id, `${path}.id`);
	const color = log.text(candidate.color, `${path}.color`);
	const sizePx = log.finiteNumber(candidate.sizePx, `${path}.sizePx`);
	const opacity = log.finiteNumber(candidate.opacity, `${path}.opacity`);
	const startedAt = log.finiteNumber(candidate.startedAt, `${path}.startedAt`);

	if (!TOOL_TYPES.includes(candidate.tool as InkToolType)) {
		log.add(`${path}.tool`, `Expected one of: ${TOOL_TYPES.join(', ')}.`);
	}

	if (!POINTER_TYPES.includes(candidate.pointerType as InkPointerType)) {
		log.add(
			`${path}.pointerType`,
			`Expected one of: ${POINTER_TYPES.join(', ')}.`
		);
	}

	if (!Array.isArray(candidate.points)) {
		log.add(`${path}.points`, 'Expected an array.');

		return null;
	}

	// A stroke with no points is not a light stroke, it is a lost one.
	if (candidate.points.length === 0) {
		log.add(`${path}.points`, 'A stroke must contain at least one point.');
	}

	const points: InkPoint[] = [];

	candidate.points.forEach((rawPoint, index) => {
		const point = readPoint(rawPoint, `${path}.points[${index}]`, log);

		if (point !== null) {
			points.push(point);
		}
	});

	if (
		id === null ||
		color === null ||
		sizePx === null ||
		opacity === null ||
		startedAt === null ||
		points.length !== candidate.points.length ||
		points.length === 0
	) {
		return null;
	}

	if (sizePx <= 0) {
		log.add(`${path}.sizePx`, 'Expected a positive width.');

		return null;
	}

	if (opacity <= 0 || opacity > 1) {
		log.add(
			`${path}.opacity`,
			'Expected a value greater than 0 and at most 1.'
		);

		return null;
	}

	return {
		id,
		tool: candidate.tool as InkToolType,
		pointerType: candidate.pointerType as InkPointerType,
		color,
		sizePx,
		opacity,
		startedAt,
		points,
	};
};

/**
 * Reads the canvas block.
 *
 * @param raw Candidate canvas.
 * @param log Issue collector.
 * @return The canvas size, or null when unusable.
 */
const readCanvas = (raw: unknown, log: IssueLog): InkCanvasSize | null => {
	if (typeof raw !== 'object' || raw === null) {
		log.add('canvas', 'Expected an object.');

		return null;
	}

	const candidate = raw as Record<string, unknown>;
	const widthPx = log.finiteNumber(candidate.widthPx, 'canvas.widthPx');
	const heightPx = log.finiteNumber(candidate.heightPx, 'canvas.heightPx');
	const dpr = log.finiteNumber(candidate.dpr, 'canvas.dpr');

	if (widthPx === null || heightPx === null || dpr === null) {
		return null;
	}

	if (widthPx <= 0 || heightPx <= 0 || dpr <= 0) {
		log.add(
			'canvas',
			'Canvas dimensions and device pixel ratio must be positive.'
		);

		return null;
	}

	return { widthPx, heightPx, dpr };
};

/**
 * Parses a serialized document.
 *
 * @param input JSON text, or an already-parsed object.
 * @return The document, or the reasons it was refused.
 */
export const parseInkDocument = (input: unknown): InkParseResult => {
	const log = new IssueLog();
	let raw: unknown = input;

	if (typeof input === 'string') {
		try {
			raw = JSON.parse(input);
		} catch {
			return {
				ok: false,
				issues: [{ path: '', message: 'Input is not valid JSON.' }],
			};
		}
	}

	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return {
			ok: false,
			issues: [{ path: '', message: 'Expected an ink document object.' }],
		};
	}

	const candidate = raw as Record<string, unknown>;

	// Version first: every field below is only meaningful under this version,
	// so reporting field errors for a future schema would be misleading.
	if (candidate.schemaVersion !== INK_SCHEMA_VERSION) {
		return {
			ok: false,
			issues: [
				{
					path: 'schemaVersion',
					message: `Unsupported ink schema version ${String(
						candidate.schemaVersion
					)}. This build reads version ${INK_SCHEMA_VERSION} only.`,
				},
			],
		};
	}

	const id = log.text(candidate.id, 'id');
	const createdAt = log.text(candidate.createdAt, 'createdAt');
	const updatedAt = log.text(candidate.updatedAt, 'updatedAt');
	const canvas = readCanvas(candidate.canvas, log);

	if (!Array.isArray(candidate.strokes)) {
		log.add('strokes', 'Expected an array.');

		return { ok: false, issues: log.issues };
	}

	const strokes: InkStroke[] = [];

	candidate.strokes.forEach((rawStroke, index) => {
		const stroke = readStroke(rawStroke, `strokes[${index}]`, log);

		if (stroke !== null) {
			strokes.push(stroke);
		}
	});

	// Duplicate identifiers would break the link between a stroke and its
	// confirmed transcription, which is the record this schema exists to keep.
	const seen = new Set<string>();

	strokes.forEach((stroke, index) => {
		if (seen.has(stroke.id)) {
			log.add(`strokes[${index}].id`, `Duplicate stroke id "${stroke.id}".`);
		}

		seen.add(stroke.id);
	});

	if (
		id === null ||
		createdAt === null ||
		updatedAt === null ||
		canvas === null ||
		strokes.length !== candidate.strokes.length ||
		log.issues.length > 0
	) {
		return { ok: false, issues: log.issues };
	}

	return {
		ok: true,
		document: {
			schemaVersion: INK_SCHEMA_VERSION,
			id,
			createdAt,
			updatedAt,
			canvas,
			strokes,
		},
	};
};
