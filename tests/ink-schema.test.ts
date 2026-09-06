/**
 * Ink schema, serialization, and corrupted-data rejection.
 *
 * The round trip is the contract this package lives or dies by: a writer who
 * saves a page of Mandinka handwriting and reopens it must get the same
 * strokes back, code point for code point and pressure for pressure.
 */

import { describe, expect, it } from '@jest/globals';

import type { InkDocument, InkStroke } from '@starisian/3iatlas-input-ink';
import {
	INK_SCHEMA_VERSION,
	NO_PRESSURE,
	createInkDocument,
	hasPressureData,
	parseInkDocument,
	serializeInkDocument,
} from '@starisian/3iatlas-input-ink';

const CANVAS = { widthPx: 800, heightPx: 200, dpr: 2 } as const;

/**
 * Builds a stroke for testing.
 *
 * @param overrides Fields to replace.
 * @return The stroke.
 */
const stroke = (overrides: Partial<InkStroke> = {}): InkStroke => ({
	id: 'stroke_1',
	tool: 'pen',
	pointerType: 'pen',
	color: '#111827',
	sizePx: 3.5,
	opacity: 1,
	startedAt: 1_700_000_000_000,
	points: [
		{ x: 10, y: 20, pressure: 0.4, t: 0 },
		{ x: 12, y: 22, pressure: 0.7, t: 16 },
	],
	...overrides,
});

/**
 * Builds a document for testing.
 *
 * @param strokes Strokes to include.
 * @return The document.
 */
const document = (strokes: readonly InkStroke[]): InkDocument => ({
	...createInkDocument(CANVAS),
	strokes,
});

describe('ink document round trip', () => {
	it('restores every stroke, point, and pressure value exactly', () => {
		const original = document([stroke(), stroke({ id: 'stroke_2' })]);
		const parsed = parseInkDocument(serializeInkDocument(original));

		expect(parsed.ok).toBe(true);

		if (!parsed.ok) {
			return;
		}

		expect(parsed.document).toEqual(original);
	});

	it('preserves a pen stroke and a pressureless mouse stroke side by side', () => {
		const pen = stroke({ id: 'pen', pointerType: 'pen' });
		const mouse = stroke({
			id: 'mouse',
			pointerType: 'mouse',
			points: [{ x: 1, y: 2, pressure: NO_PRESSURE, t: 0 }],
		});
		const parsed = parseInkDocument(
			serializeInkDocument(document([pen, mouse]))
		);

		expect(parsed.ok).toBe(true);

		if (!parsed.ok) {
			return;
		}

		const [first, second] = parsed.document.strokes;

		expect(first && hasPressureData(first)).toBe(true);
		// The mouse stroke must come back as "no pressure data", not as a
		// fabricated mid-pressure reading.
		expect(second && hasPressureData(second)).toBe(false);
		expect(second?.points[0]?.pressure).toBe(NO_PRESSURE);
	});
});

describe('corrupted ink is refused rather than repaired', () => {
	it('rejects text that is not JSON', () => {
		const parsed = parseInkDocument('{not json');

		expect(parsed.ok).toBe(false);
	});

	it('rejects an unknown schema version without reporting field errors', () => {
		const parsed = parseInkDocument({
			...document([stroke()]),
			schemaVersion: INK_SCHEMA_VERSION + 1,
		});

		expect(parsed.ok).toBe(false);

		if (parsed.ok) {
			return;
		}

		expect(parsed.issues).toHaveLength(1);
		expect(parsed.issues[0]?.path).toBe('schemaVersion');
	});

	it('rejects a non-finite coordinate instead of dropping the point', () => {
		const parsed = parseInkDocument({
			...document([stroke()]),
			strokes: [
				{
					...stroke(),
					points: [{ x: Number.NaN, y: 1, pressure: 0.5, t: 0 }],
				},
			],
		});

		expect(parsed.ok).toBe(false);
	});

	it('rejects a pressure value outside the reported range', () => {
		const parsed = parseInkDocument({
			...document([stroke()]),
			strokes: [{ ...stroke(), points: [{ x: 1, y: 1, pressure: 4, t: 0 }] }],
		});

		expect(parsed.ok).toBe(false);
	});

	it('rejects a stroke with no points', () => {
		const parsed = parseInkDocument({
			...document([stroke()]),
			strokes: [{ ...stroke(), points: [] }],
		});

		expect(parsed.ok).toBe(false);
	});

	it('rejects duplicate stroke identifiers, which would break transcription links', () => {
		const parsed = parseInkDocument(
			serializeInkDocument(document([stroke(), stroke()]))
		);

		expect(parsed.ok).toBe(false);

		if (parsed.ok) {
			return;
		}

		expect(
			parsed.issues.some((issue) => issue.message.includes('Duplicate'))
		).toBe(true);
	});

	it('rejects a zero-sized canvas', () => {
		const parsed = parseInkDocument({
			...document([stroke()]),
			canvas: { widthPx: 0, heightPx: 100, dpr: 1 },
		});

		expect(parsed.ok).toBe(false);
	});

	it('rejects an array where a document is expected', () => {
		expect(parseInkDocument([]).ok).toBe(false);
	});
});
