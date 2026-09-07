/**
 * Pointer normalization and palm rejection.
 *
 * Pointer Events give one API across pen, touch, trackpad, and mouse, which is
 * why this package uses them rather than separate touch and mouse paths. What
 * they do NOT give is a reliable palm signal: `width`/`height` are only
 * meaningful on some touchscreens, and no browser exposes a "this contact is a
 * palm" flag. So rejection here is a documented heuristic that degrades to
 * "accept the input" — refusing to draw is far worse than an occasional stray
 * mark the writer can undo.
 *
 * These functions are pure so the policy can be tested without a browser.
 */

import type { InkPointerType } from './schema';

/** The pointer fields this package reads. A structural subset of PointerEvent. */
export interface PointerSample {
	readonly pointerId: number;
	readonly pointerType: string;
	readonly isPrimary: boolean;
	readonly pressure: number;
	readonly clientX: number;
	readonly clientY: number;
	/** Contact width in CSS pixels. 0 or 1 on devices that do not measure it. */
	readonly width: number;
	readonly height: number;
	readonly buttons: number;
}

/**
 * Narrows a browser `pointerType` string to the recorded enum.
 *
 * An unrecognized value is recorded as `unknown` rather than guessed at, so a
 * future device class is visible in the data instead of being mislabelled.
 *
 * @param pointerType Raw value from the event.
 * @return The recorded pointer type.
 */
export const toInkPointerType = (pointerType: string): InkPointerType => {
	switch (pointerType) {
		case 'pen':
		case 'touch':
		case 'mouse':
			return pointerType;
		default:
			return 'unknown';
	}
};

/**
 * Contact size, in CSS pixels, above which a touch is treated as a palm.
 *
 * A fingertip on a phone reports roughly 10-30px. A resting palm reports far
 * more. Devices that do not measure contact size report 1 (the Pointer Events
 * default), which is below the threshold and therefore always accepted.
 */
export const PALM_CONTACT_SIZE_PX = 45;

/**
 * How long touch input stays suppressed after the last pen sample.
 *
 * A writer resting a hand on the screen produces touch contacts throughout a
 * pen stroke and between strokes. The window has to outlast the pause between
 * two words without outlasting a deliberate switch to finger drawing.
 */
export const PEN_PRIORITY_WINDOW_MS = 1200;

/** State the rejection policy carries between events. */
export interface PalmRejectionState {
	/** Timestamp of the last pen sample, or null when none has been seen. */
	readonly lastPenAt: number | null;
}

/** Why a sample was refused, for diagnostics. */
export type PointerRejection =
	'pen-priority' | 'palm-sized-contact' | 'not-primary' | 'no-contact';

/** Outcome of testing one sample. */
export type PointerAdmission =
	| { readonly accepted: true }
	| { readonly accepted: false; readonly reason: PointerRejection };

/** Configuration for {@link admitPointerSample}. */
export interface PalmRejectionOptions {
	/** Turn the heuristics off entirely, e.g. for finger drawing. */
	readonly enabled?: boolean;
	readonly penPriorityWindowMs?: number;
	readonly palmContactSizePx?: number;
}

/**
 * Decides whether a pointer sample should draw.
 *
 * @param sample  The sample.
 * @param state   Rejection state carried between events.
 * @param nowMs   Current time in milliseconds.
 * @param options Policy configuration.
 * @return Whether to draw, and why not when refused.
 */
export const admitPointerSample = (
	sample: PointerSample,
	state: PalmRejectionState,
	nowMs: number,
	options: PalmRejectionOptions = {}
): PointerAdmission => {
	// A pen with no button pressed is hovering, not writing. Mouse and touch
	// report a button while in contact; a hovering pen reports none.
	if (sample.buttons === 0) {
		return { accepted: false, reason: 'no-contact' };
	}

	// Multi-touch: only the first contact draws. Without this, a two-finger
	// scroll gesture leaves two lines across the page.
	if (!sample.isPrimary) {
		return { accepted: false, reason: 'not-primary' };
	}

	const enabled = options.enabled ?? true;

	if (!enabled || sample.pointerType !== 'touch') {
		return { accepted: true };
	}

	const window = options.penPriorityWindowMs ?? PEN_PRIORITY_WINDOW_MS;

	// A pen was in use a moment ago, so this touch is almost certainly the
	// hand resting on the screen rather than a deliberate finger stroke.
	if (state.lastPenAt !== null && nowMs - state.lastPenAt < window) {
		return { accepted: false, reason: 'pen-priority' };
	}

	const palmSize = options.palmContactSizePx ?? PALM_CONTACT_SIZE_PX;

	// Only meaningful where the device measures contact area; devices that do
	// not report 1 and fall through as accepted.
	if (sample.width >= palmSize || sample.height >= palmSize) {
		return { accepted: false, reason: 'palm-sized-contact' };
	}

	return { accepted: true };
};

/**
 * Advances the rejection state after a sample.
 *
 * @param state  Current state.
 * @param sample Sample just seen.
 * @param nowMs  Current time in milliseconds.
 * @return The next state.
 */
export const advancePalmRejection = (
	state: PalmRejectionState,
	sample: PointerSample,
	nowMs: number
): PalmRejectionState =>
	sample.pointerType === 'pen' ? { lastPenAt: nowMs } : state;
