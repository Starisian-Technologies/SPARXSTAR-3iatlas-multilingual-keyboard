import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * End-to-end verification of the pencil path in a real browser.
 *
 * These matter more than the unit tests for ink, because the things most
 * likely to be wrong — pointer capture, coalesced samples, `touch-action`,
 * device pixel ratio, canvas sizing — only exist in a real engine. jsdom
 * cannot fail any of them.
 */

/**
 * Draws a short stroke with the mouse.
 *
 * @param page Page under test.
 * @param originX Starting x, relative to the canvas.
 * @param originY Starting y, relative to the canvas.
 */
const canvasBox = async (page: Page): Promise<{ x: number; y: number }> => {
	const canvas = page.locator('[data-testid="surface-pencil"] canvas');

	// The example page is long, and the pencil section sits below the fold.
	// `page.mouse` works in VIEWPORT coordinates, so without scrolling first
	// the pointer lands on whatever happens to be on screen — and the test
	// silently draws nothing.
	await canvas.scrollIntoViewIfNeeded();

	const box = await canvas.boundingBox();

	if (box === null) {
		throw new Error('The ink canvas has no layout box.');
	}

	return { x: box.x, y: box.y };
};

const drawWithMouse = async (
	page: Page,
	originX = 40,
	originY = 60
): Promise<void> => {
	const box = await canvasBox(page);

	await page.mouse.move(box.x + originX, box.y + originY);
	await page.mouse.down();

	for (let step = 1; step <= 12; step += 1) {
		await page.mouse.move(
			box.x + originX + step * 6,
			box.y + originY + step * 2
		);
	}

	await page.mouse.up();
};

/**
 * Draws a stroke as a pressure-bearing pen.
 *
 * Playwright has no pen device, so the events are dispatched directly. That
 * still exercises the real listener, the real capture path, and the real
 * pressure handling — only the input device is synthetic.
 *
 * @param page     Page under test.
 * @param pressure Pressure to report on every sample.
 */
const drawWithPen = async (page: Page, pressure: number): Promise<void> => {
	await page.evaluate((reported) => {
		const canvas = document.querySelector(
			'[data-testid="surface-pencil"] canvas'
		);

		if (canvas === null) {
			throw new Error('No ink canvas.');
		}

		const box = canvas.getBoundingClientRect();

		const send = (type: string, index: number): void => {
			canvas.dispatchEvent(
				new PointerEvent(type, {
					pointerId: 7,
					pointerType: 'pen',
					isPrimary: true,
					pressure: type === 'pointerup' ? 0 : reported,
					buttons: type === 'pointerup' ? 0 : 1,
					clientX: box.left + 30 + index * 8,
					clientY: box.top + 90,
					width: 1,
					height: 1,
					bubbles: true,
					cancelable: true,
				})
			);
		};

		send('pointerdown', 0);

		for (let index = 1; index <= 20; index += 1) {
			send('pointermove', index);
		}

		send('pointerup', 20);
	}, pressure);
};

/** Reads the stroke counter the example renders. */
const strokeCount = async (page: Page): Promise<number> =>
	Number(await page.getByTestId('stroke-count').textContent());

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('surface-pencil')).toBeVisible();
});

test('captures a stroke drawn with the mouse', async ({ page }) => {
	expect(await strokeCount(page)).toBe(0);

	await drawWithMouse(page);

	expect(await strokeCount(page)).toBe(1);
	// A mouse reports no pressure, and the record must say so rather than
	// carry a fabricated mid-pressure value.
	await expect(page.getByTestId('pressure-recorded')).toHaveText('no');
});

test('records pressure from a pen', async ({ page }) => {
	await drawWithPen(page, 0.85);

	expect(await strokeCount(page)).toBe(1);
	await expect(page.getByTestId('pressure-recorded')).toHaveText('yes');
});

test('treats a half-pressure report as no pressure data', async ({ page }) => {
	// 0.5 is what the Pointer Events specification has an unsupported device
	// report, so it cannot be trusted as a measurement.
	await drawWithPen(page, 0.5);

	expect(await strokeCount(page)).toBe(1);
	await expect(page.getByTestId('pressure-recorded')).toHaveText('no');
});

test('undoes and redoes a stroke', async ({ page }) => {
	await drawWithMouse(page);
	await drawWithMouse(page, 40, 110);

	expect(await strokeCount(page)).toBe(2);

	await page.getByRole('button', { name: 'Undo', exact: true }).click();

	expect(await strokeCount(page)).toBe(1);

	await page.getByRole('button', { name: 'Redo', exact: true }).click();

	expect(await strokeCount(page)).toBe(2);
});

test('erases the stroke under the pointer', async ({ page }) => {
	await drawWithMouse(page);

	expect(await strokeCount(page)).toBe(1);

	await page.getByRole('button', { name: 'Eraser', exact: true }).click();

	const box = await canvasBox(page);

	await page.mouse.move(box.x + 46, box.y + 62);
	await page.mouse.down();
	await page.mouse.up();

	expect(await strokeCount(page)).toBe(0);
});

test('asks before clearing and honours a refusal', async ({ page }) => {
	await drawWithMouse(page);
	await page.getByRole('button', { name: 'Clear', exact: true }).click();

	await expect(page.getByRole('alertdialog')).toBeVisible();

	await page.getByRole('button', { name: 'Keep my writing' }).click();

	expect(await strokeCount(page)).toBe(1);
});

test('clears when the writer confirms, and undo brings it back', async ({
	page,
}) => {
	await drawWithMouse(page);
	await page.getByRole('button', { name: 'Clear', exact: true }).click();
	await page.getByRole('button', { name: 'Yes, clear it' }).click();

	expect(await strokeCount(page)).toBe(0);

	await page.getByRole('button', { name: 'Undo', exact: true }).click();

	expect(await strokeCount(page)).toBe(1);
});

test('saves and reopens handwriting', async ({ page }) => {
	await drawWithMouse(page);
	await drawWithMouse(page, 40, 110);
	await page.getByTestId('save-ink').click();

	await expect(page.getByTestId('ink-notice')).toContainText('Saved 2');

	await page.getByRole('button', { name: 'Clear', exact: true }).click();
	await page.getByRole('button', { name: 'Yes, clear it' }).click();

	expect(await strokeCount(page)).toBe(0);

	await page.getByTestId('reopen-ink').click();

	await expect(page.getByTestId('ink-notice')).toContainText('Reopened 2');
	expect(await strokeCount(page)).toBe(2);
});

test('offers suggestions beside the ink and inserts only on confirmation', async ({
	page,
}) => {
	const target = page.getByTestId('native-input');

	await target.fill('');
	await drawWithMouse(page);
	await page.getByTestId('recognize').click();

	await expect(page.getByTestId('recognition-panel')).toBeVisible();
	// The handwriting is shown next to the proposals, not replaced by them.
	await expect(
		page.locator('[data-testid="recognition-ink"] svg')
	).toBeVisible();

	// Nothing has been inserted yet.
	await expect(target).toHaveValue('');

	await page
		.getByRole('listitem')
		.filter({ hasText: 'kuŋo' })
		.getByRole('button', { name: 'Use this' })
		.first()
		.click();

	await expect(target).toHaveValue('kuŋo');
});

test('marks a suggestion the approved lexicon does not carry', async ({
	page,
}) => {
	await drawWithMouse(page);
	await page.getByTestId('recognize').click();

	const unapproved = page.getByRole('listitem').filter({ hasText: 'kingo' });

	// Present, offered, and labelled — never hidden and never substituted.
	await expect(unapproved).toContainText('not in the dictionary');
	await expect(
		page.getByRole('listitem').filter({ hasText: 'kuŋo' }).first()
	).toContainText('in the dictionary');
});

test('keeps writing usable when recognition is unavailable', async ({
	page,
}) => {
	await page.getByTestId('offline-toggle').check();
	await drawWithMouse(page);

	// Capture still works with no recognizer at all.
	expect(await strokeCount(page)).toBe(1);

	await page.getByTestId('recognize').click();

	await expect(page.getByTestId('recognition-unavailable')).toContainText(
		'You can still write, save, and keep your own spelling'
	);

	// And so do save and reopen.
	await page.getByTestId('save-ink').click();
	await expect(page.getByTestId('ink-notice')).toContainText('Saved 1');
});

test('keeps an unlisted spelling exactly as written while offline', async ({
	page,
}) => {
	const target = page.getByTestId('native-input');

	await target.fill('');
	await page.getByTestId('offline-toggle').check();
	await drawWithMouse(page);
	await page.getByTestId('recognize').click();
	await page.getByTestId('not-listed').click();
	await page.getByTestId('own-spelling').fill('kuŋooba');
	await page.getByTestId('keep-my-spelling').click();

	await expect(target).toHaveValue('kuŋooba');
	await expect(page.getByTestId('confirmed-list')).toContainText('not-listed');
});

test('submitting for review keeps the spelling and prepares evidence', async ({
	page,
}) => {
	await page.getByTestId('offline-toggle').check();
	await drawWithMouse(page);
	await page.getByTestId('recognize').click();
	await page.getByTestId('not-listed').click();
	await page.getByTestId('own-spelling').fill('kuŋooba');
	await page.getByTestId('submit-for-review').click();

	await expect(page.getByTestId('ink-notice')).toContainText(
		'prepared it for review'
	);
});

test('survives a viewport resize without losing strokes', async ({ page }) => {
	await drawWithMouse(page);

	expect(await strokeCount(page)).toBe(1);

	await page.setViewportSize({ width: 420, height: 720 });
	await page.waitForTimeout(150);

	expect(await strokeCount(page)).toBe(1);

	await page.setViewportSize({ width: 1200, height: 800 });
	await page.waitForTimeout(150);

	expect(await strokeCount(page)).toBe(1);
});

test('the drawing surface opts out of browser gestures', async ({ page }) => {
	// Without this the first pointermove is swallowed as a scroll and the
	// stroke starts several pixels late, which on a phone looks like the pen
	// skipping.
	const touchAction = await page
		.locator('[data-testid="surface-pencil"] canvas')
		.evaluate((element) => getComputedStyle(element).touchAction);

	expect(touchAction).toBe('none');
});

test('every ink control is reachable by keyboard', async ({ page }) => {
	const controls = ['Pen', 'Highlighter', 'Eraser', 'Select', 'Clear'];

	for (const name of controls) {
		const button = page
			.locator('[data-testid="surface-pencil"]')
			.getByRole('button', { name, exact: true });

		await button.focus();
		await expect(button).toBeFocused();
	}
});

test('the ink toolbar reports tool state without relying on colour', async ({
	page,
}) => {
	const highlighter = page
		.locator('[data-testid="surface-pencil"]')
		.getByRole('button', { name: 'Highlighter', exact: true });

	await expect(highlighter).toHaveAttribute('aria-pressed', 'false');

	await highlighter.click();

	await expect(highlighter).toHaveAttribute('aria-pressed', 'true');
});
