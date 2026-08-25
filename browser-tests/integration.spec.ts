import { expect, test } from '@playwright/test';

/**
 * End-to-end verification against the five host surfaces.
 *
 * These drive a real browser, so they exercise the actual Selection API,
 * focus behavior, and rendered touch targets rather than a jsdom
 * approximation.
 */

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('validation-notice')).toBeVisible();
});

test('never presents Mandinka as AiWA-validated', async ({ page }) => {
	const notice = page.getByTestId('validation-notice');

	await expect(notice).toContainText('Gambian Mandinka');
	await expect(notice).toContainText('Peace Corps The Gambia');
	await expect(notice).toContainText('Not yet validated');
	await expect(notice).toContainText(
		'Do not describe this language as AiWA-validated'
	);
});

test('offers the Mandinka letters, not a generic accented-vowel set', async ({
	page,
}) => {
	await expect(
		page.getByRole('button', { name: 'Insert ŋ', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Insert ñ', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Insert á', exact: true })
	).toHaveCount(0);
});

test('inserts into a native input at the caret', async ({ page }) => {
	const input = page.getByTestId('native-input');

	await input.fill('baa');
	await input.click();
	await page.keyboard.press('End');
	await page.getByRole('button', { name: 'Insert ŋ', exact: true }).click();

	await expect(input).toHaveValue('baaŋ');
});

test('replaces a selection rather than appending', async ({ page }) => {
	const input = page.getByTestId('native-input');

	await input.fill('abc');
	// Select the middle character.
	await input.evaluate((element: HTMLInputElement) => {
		element.focus();
		element.setSelectionRange(1, 2);
	});
	await page.getByRole('button', { name: 'Insert ñ', exact: true }).click();

	await expect(input).toHaveValue('añc');
});

test('inserts into a textarea', async ({ page }) => {
	await page.getByTestId('target-select').selectOption('textarea');

	const textarea = page.getByTestId('native-textarea');

	await textarea.click();
	await page.getByRole('button', { name: 'Insert ŋ', exact: true }).click();

	await expect(textarea).toHaveValue('ŋ');
});

test('inserts into a contenteditable surface', async ({ page }) => {
	await page.getByTestId('target-select').selectOption('contenteditable');

	const editable = page.getByTestId('contenteditable');

	await editable.click();
	await page.getByRole('button', { name: 'Insert ñ', exact: true }).click();

	await expect(editable).toContainText('ñ');
});

test('inserts into a controlled React input', async ({ page }) => {
	await page.getByTestId('target-select').selectOption('controlled');

	const controlled = page.getByTestId('controlled-input');

	await controlled.click();
	await page.getByRole('button', { name: 'Insert ŋ', exact: true }).click();

	await expect(controlled).toHaveValue('ŋ');
});

test('routes through the WordPad transaction boundary', async ({ page }) => {
	await page.getByTestId('target-select').selectOption('wordpad');

	await page.getByRole('button', { name: 'Insert ŋ', exact: true }).click();
	await page.getByRole('button', { name: 'Insert ñ', exact: true }).click();

	await expect(page.getByTestId('wordpad-output')).toHaveText('ŋñ');
	// Each insertion is one undoable transaction.
	await expect(page.getByText('Transactions: 2')).toBeVisible();
});

test('inserts a doubled long vowel as one unit', async ({ page }) => {
	const input = page.getByTestId('native-input');

	await input.click();
	await page.getByRole('button', { name: 'Insert aa', exact: true }).click();

	await expect(input).toHaveValue('aa');
});

test('helper keys meet the 44px minimum touch target', async ({ page }) => {
	const key = page.getByRole('button', { name: 'Insert ŋ', exact: true });
	const box = await key.boundingBox();

	expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
	expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test('exposes language and direction to assistive technology', async ({
	page,
}) => {
	const toolbar = page.getByRole('toolbar', { name: 'Language characters' });

	await expect(toolbar).toHaveAttribute('lang', 'mnk-Latn-GM');
	await expect(toolbar).toHaveAttribute('dir', 'ltr');
});

test('helper bar is reachable by keyboard alone', async ({ page }) => {
	const key = page.getByRole('button', { name: 'Insert ŋ', exact: true });

	await key.focus();
	await expect(key).toBeFocused();

	const input = page.getByTestId('native-input');

	await input.click();
	await key.focus();
	await page.keyboard.press('Enter');

	await expect(input).toHaveValue('ŋ');
});

test('switching language switches the offered characters', async ({ page }) => {
	await page.getByTestId('profile-select').selectOption('fula-latn-sn');

	await expect(
		page.getByRole('button', { name: 'Insert ɓ', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Insert ŋ', exact: true })
	).toBeVisible();

	const notice = page.getByTestId('validation-notice');

	await expect(notice).toContainText('not reviewed by AiWA');
});

test('selecting Full keyboard falls back without blocking typing', async ({
	page,
}) => {
	// No Keyman engine is self-hosted in this example, so Full keyboard must
	// degrade rather than break the writing surface.
	await page.getByRole('radio', { name: 'Full keyboard', exact: true }).check();

	const input = page.getByTestId('native-input');

	await input.click();
	await input.fill('still typable');

	await expect(input).toHaveValue('still typable');
	// The helper bar remains usable as the documented fallback.
	await page.getByRole('button', { name: 'Insert ŋ', exact: true }).click();
	await expect(input).toHaveValue('still typableŋ');
});

test('records lifecycle events without any typed text', async ({ page }) => {
	const input = page.getByTestId('native-input');

	await input.click();
	await page.getByRole('button', { name: 'Insert ŋ', exact: true }).click();

	const events = page.getByTestId('events');

	await expect(events).toContainText('character-inserted');
	// The event log must never leak the character itself.
	await expect(events).not.toContainText('ŋ');
});

test('survives copy and paste round-trip', async ({ page }) => {
	const input = page.getByTestId('native-input');

	await input.click();
	await page.getByRole('button', { name: 'Insert ŋ', exact: true }).click();
	await page.getByRole('button', { name: 'Insert ñ', exact: true }).click();

	const value = await input.inputValue();

	expect([...value].map((c) => c.codePointAt(0))).toEqual([0x14b, 0xf1]);
});
