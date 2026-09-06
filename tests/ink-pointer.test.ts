/**
 * Pointer admission: pen, touch, mouse, and palm rejection.
 *
 * The rules under test are heuristics, and the most important property is that
 * they DEGRADE TOWARD DRAWING. A device that reports no contact size, an
 * unfamiliar pointer type, or a browser with no pen support must still let the
 * writer write.
 */

import { describe, expect, it } from '@jest/globals';

import type { PointerSample } from '@starisian/3iatlas-input-ink';
import {
	PALM_CONTACT_SIZE_PX,
	PEN_PRIORITY_WINDOW_MS,
	admitPointerSample,
	advancePalmRejection,
	toInkPointerType,
} from '@starisian/3iatlas-input-ink';

/**
 * Builds a pointer sample.
 *
 * @param overrides Fields to replace.
 * @return The sample.
 */
const sample = (overrides: Partial<PointerSample> = {}): PointerSample => ({
	pointerId: 1,
	pointerType: 'pen',
	isPrimary: true,
	pressure: 0.6,
	clientX: 10,
	clientY: 10,
	width: 1,
	height: 1,
	buttons: 1,
	...overrides,
});

const NO_PEN = { lastPenAt: null } as const;

describe('pointer type mapping', () => {
	it('maps the three known device classes', () => {
		expect(toInkPointerType('pen')).toBe('pen');
		expect(toInkPointerType('touch')).toBe('touch');
		expect(toInkPointerType('mouse')).toBe('mouse');
	});

	it('records an unfamiliar device as unknown rather than guessing', () => {
		expect(toInkPointerType('eraser-tip')).toBe('unknown');
		expect(toInkPointerType('')).toBe('unknown');
	});
});

describe('admission', () => {
	it('accepts a pen in contact', () => {
		expect(admitPointerSample(sample(), NO_PEN, 0).accepted).toBe(true);
	});

	it('accepts a mouse with a button held', () => {
		expect(
			admitPointerSample(sample({ pointerType: 'mouse' }), NO_PEN, 0).accepted
		).toBe(true);
	});

	it('accepts a finger on a device that does not measure contact size', () => {
		expect(
			admitPointerSample(sample({ pointerType: 'touch' }), NO_PEN, 0).accepted
		).toBe(true);
	});

	it('refuses a hovering pen, which reports no buttons', () => {
		const result = admitPointerSample(sample({ buttons: 0 }), NO_PEN, 0);

		expect(result.accepted).toBe(false);
		expect(result.accepted === false && result.reason).toBe('no-contact');
	});

	it('refuses a second simultaneous contact, so a pinch does not draw', () => {
		const result = admitPointerSample(sample({ isPrimary: false }), NO_PEN, 0);

		expect(result.accepted === false && result.reason).toBe('not-primary');
	});
});

describe('palm rejection', () => {
	it('refuses touch while a pen was recently in use', () => {
		const state = advancePalmRejection(NO_PEN, sample(), 1000);
		const result = admitPointerSample(
			sample({ pointerType: 'touch' }),
			state,
			1000 + PEN_PRIORITY_WINDOW_MS - 1
		);

		expect(result.accepted === false && result.reason).toBe('pen-priority');
	});

	it('accepts touch again once the pen window has passed', () => {
		const state = advancePalmRejection(NO_PEN, sample(), 1000);
		const result = admitPointerSample(
			sample({ pointerType: 'touch' }),
			state,
			1000 + PEN_PRIORITY_WINDOW_MS + 1
		);

		expect(result.accepted).toBe(true);
	});

	it('refuses a palm-sized contact', () => {
		const result = admitPointerSample(
			sample({ pointerType: 'touch', width: PALM_CONTACT_SIZE_PX + 5 }),
			NO_PEN,
			0
		);

		expect(result.accepted === false && result.reason).toBe(
			'palm-sized-contact'
		);
	});

	it('never suppresses a pen, however large the reported contact', () => {
		expect(
			admitPointerSample(sample({ width: 200, height: 200 }), NO_PEN, 0)
				.accepted
		).toBe(true);
	});

	it('draws with a finger when the heuristics are turned off', () => {
		const state = advancePalmRejection(NO_PEN, sample(), 1000);
		const result = admitPointerSample(
			sample({ pointerType: 'touch', width: 200 }),
			state,
			1000,
			{ enabled: false }
		);

		expect(result.accepted).toBe(true);
	});

	it('only a pen advances the pen-priority clock', () => {
		const afterTouch = advancePalmRejection(
			NO_PEN,
			sample({ pointerType: 'touch' }),
			500
		);

		expect(afterTouch.lastPenAt).toBeNull();
		expect(advancePalmRejection(NO_PEN, sample(), 500).lastPenAt).toBe(500);
	});
});
