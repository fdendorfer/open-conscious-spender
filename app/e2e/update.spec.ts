import { expect, test } from '@playwright/test';
import { waitForDataset } from './helpers';

test.describe('app updates', () => {
	test('settings shows the package version and commit', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.getByTestId('app-version')).toHaveText(/^\d+\.\d+\.\d+\+\w+$/);
	});

	test('a newer version whose worker cannot load keeps the cached app', async ({
		page,
		context
	}) => {
		await page.goto('/');
		await waitForDataset(page);
		await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
			timeout: 15_000
		});

		// The version check gets through, then the connection drops before the new worker loads.
		await context.route('**/_app/version.json', async (route) => {
			await route.fulfill({ json: { version: 'newer-build' } });
			await context.setOffline(true);
		});
		await page.evaluate(() => ((window as unknown as { stale: boolean }).stale = true));
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await page.waitForTimeout(2000);
		expect(await page.evaluate(() => 'stale' in window)).toBe(true);

		await page.reload();
		await waitForDataset(page);
		await page.getByRole('main').getByRole('combobox').fill('Nestlé');
		await expect(page.getByRole('option').first()).toContainText('Nestlé');
	});
});
