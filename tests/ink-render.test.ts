/**
 * Rendering and export.
 *
 * The export is what a reader sees when the ink is displayed outside the
 * editor — in a saved document, a printout, or a review screen — so it has to
 * be well-formed, self-describing, and free of injected markup.
 */

import { describe, expect, it } from '@jest/globals';

import type { InkDocument, InkStroke } from '@starisian/3iatlas-input-ink';
import {
	DEFAULT_TOOL_PRESETS,
	NO_PRESSURE,
	createInkDocument,
	documentBounds,
	inkDocumentToSvg,
	outlineToPathData,
	strokeContainsPoint,
	strokeOutline,
	strokePathData,
} from '@starisian/3iatlas-input-ink';

const CANVAS = { widthPx: 400, heightPx: 200, dpr: 1 } as const;

/**
 * Builds a stroke.
 *
 * @param overrides Fields to replace.
 * @return The stroke.
 */
const stroke = (overrides: Partial<InkStroke> = {}): InkStroke => ({
	id: 's1',
	tool: 'pen',
	pointerType: 'pen',
	color: '#112233',
	sizePx: 4,
	opacity: 1,
	startedAt: 0,
	points: [
		{ x: 10, y: 10, pressure: 0.3, t: 0 },
		{ x: 40, y: 10, pressure: 0.9, t: 16 },
		{ x: 70, y: 30, pressure: 0.5, t: 32 },
	],
	...overrides,
});

/**
 * Builds a document.
 *
 * @param strokes Strokes to include.
 * @return The document.
 */
const document = (strokes: readonly InkStroke[]): InkDocument => ({
	...createInkDocument(CANVAS),
	strokes,
});

/**
 * Measures the vertical extent of an outline, i.e. the rendered stroke width.
 *
 * @param outline Outline points.
 * @return The height of the outline's bounding box.
 */
const widthOf = (outline: readonly (readonly number[])[]): number => {
	const ys = outline.map((point) => point[1] ?? 0);

	return Math.max(...ys) - Math.min(...ys);
};

/**
 * Builds a long, densely-sampled horizontal stroke at a fixed pressure.
 *
 * Density matters: on a two-point stroke the end tapers cover the whole line
 * and swamp the pressure response, so a sparse fixture would measure the taper
 * rather than the thinning it is meant to test. Real handwriting is sampled at
 * device rate and looks like this.
 *
 * @param pressure Pressure for every sample.
 * @param tool     Tool the stroke was drawn with.
 * @return The stroke.
 */
const atPressure = (
	pressure: number,
	tool: InkStroke['tool'] = 'pen'
): InkStroke =>
	stroke({
		tool,
		points: Array.from({ length: 40 }, (_unused, index) => ({
			x: index * 5,
			y: 0,
			pressure,
			t: index * 8,
		})),
	});

describe('outlines', () => {
	it('produces a closed polygon for a stroke', () => {
		const outline = strokeOutline(stroke(), DEFAULT_TOOL_PRESETS.pen);

		expect(outline.length).toBeGreaterThan(3);
	});

	it('produces a path that starts with a move and closes', () => {
		const data = strokePathData(stroke());

		expect(data.startsWith('M')).toBe(true);
		expect(data.endsWith('Z')).toBe(true);
	});

	it('returns an empty path for an empty outline rather than broken markup', () => {
		expect(outlineToPathData([])).toBe('');
	});

	it('varies width with pressure for the pen', () => {
		// A thinning tool must render a light sample and a heavy sample
		// differently; otherwise capturing pressure achieves nothing.
		const light = strokeOutline(atPressure(0.05), DEFAULT_TOOL_PRESETS.pen);
		const heavy = strokeOutline(atPressure(1), DEFAULT_TOOL_PRESETS.pen);

		expect(widthOf(heavy)).toBeGreaterThan(widthOf(light));
	});

	it('does not vary the highlighter with pressure', () => {
		// A highlighter that thins under a light touch reads as a broken
		// marker rather than as emphasis, so its preset disables thinning.
		const light = strokeOutline(
			atPressure(0.05, 'highlighter'),
			DEFAULT_TOOL_PRESETS.highlighter
		);
		const heavy = strokeOutline(
			atPressure(1, 'highlighter'),
			DEFAULT_TOOL_PRESETS.highlighter
		);

		expect(widthOf(heavy)).toBeCloseTo(widthOf(light), 5);
	});

	it('renders a pressureless stroke without collapsing it', () => {
		const outline = strokeOutline(
			stroke({
				pointerType: 'mouse',
				points: [
					{ x: 0, y: 0, pressure: NO_PRESSURE, t: 0 },
					{ x: 50, y: 0, pressure: NO_PRESSURE, t: 10 },
				],
			}),
			DEFAULT_TOOL_PRESETS.pen
		);

		expect(outline.length).toBeGreaterThan(3);
	});
});

describe('hit testing', () => {
	it('hits a point on the stroke', () => {
		expect(strokeContainsPoint(stroke(), 25, 10)).toBe(true);
	});

	it('misses a point well away from it', () => {
		expect(strokeContainsPoint(stroke(), 300, 180)).toBe(false);
	});

	it('hits between two sampled points, not just at them', () => {
		// A fast stroke samples sparsely. Testing only the samples would leave
		// visible ink the writer cannot erase.
		const sparse = stroke({
			points: [
				{ x: 0, y: 0, pressure: 0.5, t: 0 },
				{ x: 100, y: 0, pressure: 0.5, t: 8 },
			],
		});

		expect(strokeContainsPoint(sparse, 50, 0)).toBe(true);
	});

	it('hits a single-point dot', () => {
		const dot = stroke({ points: [{ x: 5, y: 5, pressure: 0.5, t: 0 }] });

		expect(strokeContainsPoint(dot, 5, 5)).toBe(true);
		expect(strokeContainsPoint(dot, 40, 40)).toBe(false);
	});

	it('widens the target by the requested tolerance', () => {
		expect(strokeContainsPoint(stroke(), 25, 20)).toBe(false);
		expect(strokeContainsPoint(stroke(), 25, 20, 12)).toBe(true);
	});
});

describe('bounds', () => {
	it('pads by the stroke width so a flat stroke is still hittable', () => {
		const flat = stroke({
			points: [
				{ x: 0, y: 50, pressure: 0.5, t: 0 },
				{ x: 100, y: 50, pressure: 0.5, t: 8 },
			],
		});
		const bounds = documentBounds([flat]);

		expect(bounds).not.toBeNull();
		expect((bounds?.maxY ?? 0) - (bounds?.minY ?? 0)).toBeGreaterThan(0);
	});

	it('reports nothing for an empty page', () => {
		expect(documentBounds([])).toBeNull();
	});
});

describe('SVG export', () => {
	it('emits a namespaced SVG with a path per stroke', () => {
		const svg = inkDocumentToSvg(document([stroke(), stroke({ id: 's2' })]));

		expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
		expect(svg.match(/<path /g)).toHaveLength(2);
	});

	it('carries the stroke colour and opacity', () => {
		const svg = inkDocumentToSvg(
			document([
				stroke({ tool: 'highlighter', color: '#facc15', opacity: 0.4 }),
			])
		);

		expect(svg).toContain('fill="#facc15"');
		expect(svg).toContain('fill-opacity="0.400"');
	});

	it('escapes a colour that would otherwise break out of the attribute', () => {
		// A restored document is untrusted input even when it came from the
		// product's own storage, and this markup is a sink.
		const svg = inkDocumentToSvg(
			document([stroke({ color: '#000" onload="alert(1)' })])
		);

		expect(svg).not.toContain('onload="alert(1)"');
		expect(svg).toContain('&quot;');
	});

	it('bounds an out-of-range opacity rather than emitting it', () => {
		const svg = inkDocumentToSvg(
			document([stroke({ opacity: Number.POSITIVE_INFINITY })])
		);

		expect(svg).toContain('fill-opacity="1"');
	});

	it('uses the whole canvas when not trimming', () => {
		const svg = inkDocumentToSvg(document([stroke()]), { trim: false });

		expect(svg).toContain('viewBox="0.00 0.00 400.00 200.00"');
	});

	it('crops to the ink when trimming', () => {
		const svg = inkDocumentToSvg(document([stroke()]), { trim: true });

		expect(svg).not.toContain('viewBox="0.00 0.00 400.00 200.00"');
	});

	it('escapes the title rather than letting markup through', () => {
		const svg = inkDocumentToSvg(document([stroke()]), {
			title: '<script>alert(1)</script>',
		});

		expect(svg).not.toContain('<script>');
		expect(svg).toContain('&lt;script&gt;');
	});

	it('exports an empty page as valid, empty markup', () => {
		const svg = inkDocumentToSvg(document([]));

		expect(svg).toContain('<svg');
		expect(svg).not.toContain('<path');
	});
});
