/**
 * Stroke rendering and export.
 *
 * Outlines come from `perfect-freehand` (MIT), which turns a pressure-bearing
 * point list into a closed polygon. Rendering the polygon rather than a
 * variable-width line is what makes a pen stroke taper the way handwriting
 * does, and it is why the vector record keeps pressure at all.
 *
 * Everything here is a pure function of the stroke plus a scale factor, so the
 * same strokes render identically to a canvas, to an SVG string, and to a
 * raster export.
 */

import { getStroke } from 'perfect-freehand';

import type { InkDocument, InkStroke, InkToolType } from './schema';
import { NO_PRESSURE } from './schema';
import { documentBounds } from './geometry';

/** How a tool draws. */
export interface InkToolPreset {
	readonly sizePx: number;
	readonly color: string;
	readonly opacity: number;
	/** How strongly pressure narrows the stroke. 0 disables the effect. */
	readonly thinning: number;
	/** Whether the ends taper. A highlighter has flat, chisel-like ends. */
	readonly taper: boolean;
}

/**
 * Default tool presets.
 *
 * The highlighter is wide, translucent, untapered, and insensitive to
 * pressure, because a highlighter that thins under a light touch reads as a
 * broken marker rather than as emphasis.
 */
export const DEFAULT_TOOL_PRESETS: Readonly<
	Record<InkToolType, InkToolPreset>
> = {
	pen: {
		sizePx: 3.5,
		color: '#111827',
		opacity: 1,
		thinning: 0.6,
		taper: true,
	},
	highlighter: {
		sizePx: 18,
		color: '#facc15',
		opacity: 0.4,
		thinning: 0,
		taper: false,
	},
};

/**
 * Pressure used when the device reports none.
 *
 * Fixed rather than simulated from velocity: a stroke captured from a mouse
 * must round-trip to the same shape every time, and velocity simulation makes
 * the rendering depend on how fast the replay happened.
 */
const FALLBACK_PRESSURE = 0.5;

/**
 * Builds the outline polygon for a stroke.
 *
 * @param stroke  Stroke to outline.
 * @param preset  Tool behavior.
 * @param scale   Multiplier applied to coordinates and width.
 * @return The outline points.
 */
export const strokeOutline = (
	stroke: InkStroke,
	preset: InkToolPreset,
	scale = 1
): readonly (readonly number[])[] => {
	const input = stroke.points.map((point) => [
		point.x * scale,
		point.y * scale,
		point.pressure === NO_PRESSURE ? FALLBACK_PRESSURE : point.pressure,
	]);

	return getStroke(input, {
		size: stroke.sizePx * scale,
		thinning: preset.thinning,
		smoothing: 0.5,
		streamline: 0.5,
		// Pressure is captured, never invented — see FALLBACK_PRESSURE.
		simulatePressure: false,
		start: { cap: true, taper: preset.taper ? stroke.sizePx * scale : 0 },
		end: { cap: true, taper: preset.taper ? stroke.sizePx * scale : 0 },
		last: true,
	});
};

/**
 * Converts an outline polygon to an SVG path.
 *
 * Coordinates are rounded to two decimals: sub-pixel precision beyond that is
 * invisible and roughly doubles the exported file size, which matters on a
 * metered connection.
 *
 * @param outline Outline points.
 * @return SVG path data, or an empty string for a degenerate outline.
 */
export const outlineToPathData = (
	outline: readonly (readonly number[])[]
): string => {
	if (outline.length === 0) {
		return '';
	}

	const round = (value: number): string => value.toFixed(2);
	const parts: string[] = [];

	outline.forEach((point, index) => {
		const x = point[0];
		const y = point[1];

		if (x === undefined || y === undefined) {
			return;
		}

		parts.push(`${index === 0 ? 'M' : 'L'}${round(x)},${round(y)}`);
	});

	if (parts.length === 0) {
		return '';
	}

	return `${parts.join(' ')} Z`;
};

/**
 * Builds the SVG path data for one stroke.
 *
 * @param stroke  Stroke to render.
 * @param presets Tool presets in force.
 * @param scale   Coordinate multiplier.
 * @return SVG path data.
 */
export const strokePathData = (
	stroke: InkStroke,
	presets: Readonly<Record<InkToolType, InkToolPreset>> = DEFAULT_TOOL_PRESETS,
	scale = 1
): string =>
	outlineToPathData(strokeOutline(stroke, presets[stroke.tool], scale));

/** Options accepted by {@link renderInkToCanvas}. */
export interface InkCanvasRenderOptions {
	readonly presets?: Readonly<Record<InkToolType, InkToolPreset>>;
	/** Multiplier from document coordinates to CSS pixels. */
	readonly scale?: number;
	/** Identifiers to draw with a selection halo. */
	readonly selectedIds?: readonly string[];
	/** Colour of the selection halo. */
	readonly selectionColor?: string;
}

/**
 * Draws strokes onto a 2D canvas context.
 *
 * The caller owns clearing and device-pixel-ratio scaling of the context, so
 * that a live surface can repaint only what changed while an export paints
 * everything once.
 *
 * @param context 2D context to draw into.
 * @param strokes Strokes in draw order.
 * @param options Rendering options.
 */
export const renderInkToCanvas = (
	context: CanvasRenderingContext2D,
	strokes: readonly InkStroke[],
	options: InkCanvasRenderOptions = {}
): void => {
	const presets = options.presets ?? DEFAULT_TOOL_PRESETS;
	const scale = options.scale ?? 1;
	const selected = new Set(options.selectedIds ?? []);
	const selectionColor = options.selectionColor ?? '#2563eb';

	for (const stroke of strokes) {
		const outline = strokeOutline(stroke, presets[stroke.tool], scale);

		if (outline.length === 0) {
			continue;
		}

		const path = new Path2D(outlineToPathData(outline));

		context.save();
		context.globalAlpha = stroke.opacity;
		context.fillStyle = stroke.color;
		context.fill(path);
		context.restore();

		if (selected.has(stroke.id)) {
			context.save();
			context.globalAlpha = 1;
			context.strokeStyle = selectionColor;
			context.lineWidth = Math.max(1, scale);
			// Dashed, so selection is not signalled by colour alone
			// (specification section 11).
			context.setLineDash([4 * scale, 3 * scale]);
			context.stroke(path);
			context.restore();
		}
	}
};

/** Options accepted by {@link inkDocumentToSvg}. */
export interface InkSvgOptions {
	readonly presets?: Readonly<Record<InkToolType, InkToolPreset>>;
	/** Padding around the ink, in document units. */
	readonly paddingPx?: number;
	/** Crop to the ink rather than exporting the whole canvas. */
	readonly trim?: boolean;
	/** Accessible description written into the SVG's `<title>`. */
	readonly title?: string;
}

/**
 * Escapes text for inclusion in XML.
 *
 * @param value Text to escape.
 * @return Escaped text.
 */
const escapeXml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/**
 * Exports a document as an SVG string.
 *
 * SVG rather than PNG is the default export because it stays legible at any
 * size, compresses far smaller than a raster of the same page, and keeps the
 * stroke shapes the writer actually made.
 *
 * @param document Document to export.
 * @param options  Export options.
 * @return SVG markup.
 */
export const inkDocumentToSvg = (
	document: InkDocument,
	options: InkSvgOptions = {}
): string => {
	const presets = options.presets ?? DEFAULT_TOOL_PRESETS;
	const padding = options.paddingPx ?? 8;
	const bounds =
		options.trim === true ? documentBounds(document.strokes) : null;

	const minX = bounds === null ? 0 : bounds.minX - padding;
	const minY = bounds === null ? 0 : bounds.minY - padding;
	const width =
		bounds === null
			? document.canvas.widthPx
			: Math.max(1, bounds.maxX - bounds.minX + padding * 2);
	const height =
		bounds === null
			? document.canvas.heightPx
			: Math.max(1, bounds.maxY - bounds.minY + padding * 2);

	const paths = document.strokes
		.map((stroke) => {
			const data = strokePathData(stroke, presets);

			if (data === '') {
				return '';
			}

			// Colour is escaped and opacity is re-coerced to a bounded number
			// even though both are typed: this markup is a sink, and a
			// document reaching it without going through `parseInkDocument`
			// is exactly the case a sink has to survive.
			const opacity = Number.isFinite(stroke.opacity)
				? Math.min(Math.max(stroke.opacity, 0), 1).toFixed(3)
				: '1';

			return (
				`<path d="${data}" fill="${escapeXml(stroke.color)}" ` +
				`fill-opacity="${opacity}" fill-rule="nonzero"/>`
			);
		})
		.filter((markup) => markup !== '')
		.join('');

	const title =
		options.title === undefined
			? ''
			: `<title>${escapeXml(options.title)}</title>`;

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" ` +
		`viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ` +
		`${width.toFixed(2)} ${height.toFixed(2)}" ` +
		`width="${width.toFixed(0)}" height="${height.toFixed(0)}" ` +
		`role="img">${title}${paths}</svg>`
	);
};
