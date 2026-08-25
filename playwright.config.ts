import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the built example application.
 *
 * Desktop Chromium plus a mobile viewport with touch enabled, which covers the
 * touch-target and portrait-layout rules in specification section 6.3. Physical
 * Android and iOS device testing (section 14.2) is still required and is not
 * replaced by this emulation.
 */
export default defineConfig({
	testDir: './browser-tests',
	fullyParallel: true,
	reporter: process.env.CI ? 'list' : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'off',
		// CI and normal development use Playwright's matching browser. A custom
		// executable remains available for development containers that expose one.
		launchOptions: process.env.CHROMIUM_PATH
			? { executablePath: process.env.CHROMIUM_PATH }
			: {},
	},
	webServer: {
		command:
			'pnpm --filter @starisian/3iatlas-multilingual-input-example run build && pnpm --filter @starisian/3iatlas-multilingual-input-example run preview',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
	],
});
