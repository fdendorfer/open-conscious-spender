import { expect, test } from '@playwright/test';
import { waitForDataset } from './helpers';

test.describe('app updates', () => {
	test('settings shows the package version and commit', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.getByTestId('app-version')).toHaveText(/^\d+\.\d+\.\d+\+\w+$/);
	});

	test('a newer deploy drops the cached app and reloads once', async ({ page, context }) => {
		await page.goto('/');
		await waitForDataset(page);
		await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
			timeout: 15_000
		});

		let versionChecks = 0;
		await context.route('**/_app/version.json', (route) => {
			versionChecks++;
			return route.fulfill({ json: { version: 'newer-build' } });
		});

		await page.evaluate(() => ((window as unknown as { stale: boolean }).stale = true));
		const reloaded = page.waitForEvent('load');
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await reloaded;
		expect(await page.evaluate(() => 'stale' in window)).toBe(false);

		// The mocked version never matches, so only the guard stops a second reload.
		const checksAfterReload = versionChecks;
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await expect.poll(() => versionChecks).toBeGreaterThan(checksAfterReload);
		await page.waitForTimeout(1000);
		await expect(page.getByRole('main').getByRole('combobox')).toBeVisible();
	});
});
