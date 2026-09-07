/**
 * Stroke geometry: bounds and hit-testing.
 *
 * Used by the eraser and by stroke selection. Both need to answer "which
 * stroke is under this point", and both must answer it against the captured
 * vector points rather than against rendered pixels, so that erasing works
 * identically at any zoom, device pixel ratio, or canvas size.
 */

import type { InkPoint, InkStroke } from './schema';

/** An axis-aligned box in canvas coordinates. */
export interface InkBounds {
	readonly minX: number;
	readonly minY: number;
	readonly maxX: number;
	readonly maxY: number;
}

/**
 * Computes the bounding box of a stroke, widened by its own width.
 *
 * The half-width padding matters: a perfectly horizontal stroke has zero
 * height as a point set, and an unpadded box would make it unhittable.
 *
 * @param stroke Stroke to measure.
 * @return The padded bounds, or null when the stroke has no points.
 */
export const strokeBounds = (stroke: InkStroke): InkBounds | null => {
	const first = stroke.points[0];

	if (first === undefined) {
		return null;
	}

	let minX = first.x;
	let maxX = first.x;
	let minY = first.y;
	let maxY = first.y;

	for (const point of stroke.points) {
		minX = Math.min(minX, point.x);
		maxX = Math.max(maxX, point.x);
		minY = Math.min(minY, point.y);
		maxY = Math.max(maxY, point.y);
	}

	const padding = stroke.sizePx / 2;

	return {
		minX: minX - padding,
		maxX: maxX + padding,
		minY: minY - padding,
		maxY: maxY + padding,
	};
};

/**
 * Computes the bounding box covering several strokes.
 *
 * @param strokes Strokes to measure.
 * @return The union of their bounds, or null when nothing is measurable.
 */
export const documentBounds = (
	strokes: readonly InkStroke[]
): InkBounds | null => {
	let result: InkBounds | null = null;

	for (const stroke of strokes) {
		const bounds = strokeBounds(stroke);

		if (bounds === null) {
			continue;
		}

		result =
			result === null
				? bounds
				: {
						minX: Math.min(result.minX, bounds.minX),
						minY: Math.min(result.minY, bounds.minY),
						maxX: Math.max(result.maxX, bounds.maxX),
						maxY: Math.max(result.maxY, bounds.maxY),
					};
	}

	return result;
};

/**
 * Squared distance from a point to a line segment.
 *
 * Squared, because the caller only ever compares it against another squared
 * distance; taking the root once per segment is wasted work on a hot path.
 *
 * @param px Point x.
 * @param py Point y.
 * @param ax Segment start x.
 * @param ay Segment start y.
 * @param bx Segment end x.
 * @param by Segment end y.
 * @return The squared distance.
 */
const squaredDistanceToSegment = (
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number
): number => {
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSquared = dx * dx + dy * dy;

	// Degenerate segment: the two endpoints coincide, so fall back to the
	// point-to-point distance rather than dividing by zero.
	if (lengthSquared === 0) {
		return (px - ax) * (px - ax) + (py - ay) * (py - ay);
	}

	const projection = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
	const clamped = Math.max(0, Math.min(1, projection));
	const nearestX = ax + clamped * dx;
	const nearestY = ay + clamped * dy;

	return (px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY);
};

/**
 * Reports whether a point lies within a stroke's inked area.
 *
 * Tests the segments between captured points, not just the points themselves:
 * a fast stroke samples sparsely, and testing only samples would leave gaps a
 * writer can see ink in but cannot erase.
 *
 * @param stroke    Stroke to test.
 * @param x         Point x, in canvas coordinates.
 * @param y         Point y, in canvas coordinates.
 * @param toleranceP Extra radius in CSS pixels, e.g. the eraser's own size.
 * @return True when the point is on the stroke.
 */
export const strokeContainsPoint = (
	stroke: InkStroke,
	x: number,
	y: number,
	tolerancePx = 0
): boolean => {
	const bounds = strokeBounds(stroke);

	if (bounds === null) {
		return false;
	}

	// Cheap rejection first; most strokes fail this on any given hit test.
	if (
		x < bounds.minX - tolerancePx ||
		x > bounds.maxX + tolerancePx ||
		y < bounds.minY - tolerancePx ||
		y > bounds.maxY + tolerancePx
	) {
		return false;
	}

	const radius = stroke.sizePx / 2 + tolerancePx;
	const radiusSquared = radius * radius;
	const points: readonly InkPoint[] = stroke.points;
	const first = points[0];

	if (first === undefined) {
		return false;
	}

	// A single-point stroke is a dot, which has no segment to test.
	if (points.length === 1) {
		return (
			(x - first.x) * (x - first.x) + (y - first.y) * (y - first.y) <=
			radiusSquared
		);
	}

	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];

		if (start === undefined || end === undefined) {
			continue;
		}

		if (
			squaredDistanceToSegment(x, y, start.x, start.y, end.x, end.y) <=
			radiusSquared
		) {
			return true;
		}
	}

	return false;
};

/**
 * Finds the topmost stroke under a point.
 *
 * Iterates back to front so the stroke drawn most recently — the one the
 * writer sees on top — is the one selected or erased.
 *
 * @param strokes     Strokes in draw order.
 * @param x           Point x.
 * @param y           Point y.
 * @param tolerancePx Extra radius in CSS pixels.
 * @return The stroke, or null when the point is on blank canvas.
 */
export const findStrokeAtPoint = (
	strokes: readonly InkStroke[],
	x: number,
	y: number,
	tolerancePx = 0
): InkStroke | null => {
	for (let index = strokes.length - 1; index >= 0; index -= 1) {
		const stroke = strokes[index];

		if (
			stroke !== undefined &&
			strokeContainsPoint(stroke, x, y, tolerancePx)
		) {
			return stroke;
		}
	}

	return null;
};
