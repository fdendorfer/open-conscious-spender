import { expect, test } from '@playwright/test';
import { failDatasetDownload, waitForDataset } from './helpers';

test.describe('offline and failure states', () => {
	test('a first run with no connection offers a retry, then recovers', async ({ page }) => {
		await failDatasetDownload(page);
		await page.goto('/');
		await expect(page.getByRole('alert')).toContainText("dataset couldn't be downloaded");

		await page.unroute('https://raw.githubusercontent.com/**');
		await page.getByRole('button', { name: 'Try again' }).click();
		await waitForDataset(page);
	});

	test('the ranking page fails soft too', async ({ page }) => {
		await failDatasetDownload(page);
		await page.goto('/companies');
		await expect(page.getByRole('alert')).toBeVisible();
	});

	test('a company page fails soft too', async ({ page }) => {
		await failDatasetDownload(page);
		await page.goto('/brand/nestle');
		await expect(page.getByRole('alert')).toBeVisible();
	});

	test('a second visit works with the network gone', async ({ page, context }) => {
		await page.goto('/');
		await waitForDataset(page);
		// Give the service worker time to precache the shell.
		await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
			timeout: 15_000
		});

		await context.setOffline(true);
		await page.reload();
		await waitForDataset(page);
		await page.getByRole('main').getByRole('combobox').fill('Nestlé');
		await expect(page.getByRole('option').first()).toContainText('Nestlé');
	});

	test('an unknown company slug says so instead of hanging', async ({ page }) => {
		await page.goto('/brand/not-a-real-company');
		await expect(page.getByText('No company found')).toBeVisible();
	});
});
