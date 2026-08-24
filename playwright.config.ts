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
		// Use the Chromium preinstalled in the image rather than downloading a
		// build matching this Playwright version.
		// In CI Playwright installs a matching Chromium, so let it resolve its
		// own binary. Locally, use the one preinstalled in the dev image.
		launchOptions: process.env.CI
			? {}
			: {
					executablePath:
						process.env.CHROMIUM_PATH ??
						'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
				},
	},
	webServer: {
		command:
			'pnpm --filter @starisian/3iatlas-multilingual-input-example run preview',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
	],
});
