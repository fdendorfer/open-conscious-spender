import { defineConfig, devices } from '@playwright/test';

// A phone viewport is the honest default: the app is used standing in a shop.
export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
	webServer: {
		// Preview, not dev: the service worker and registerSW.js only exist in a real build.
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
