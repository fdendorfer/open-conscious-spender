import { expect, test, type Page } from '@playwright/test';
import { enableShoppingMode, installFakeCamera, seedTrip, waitForDataset } from './helpers';

/** Reloads, opens the camera and its trip panel, the only place the basket is shown. */
async function openTrip(page: Page) {
	await page.reload();
	await waitForDataset(page);
	await page.getByRole('button', { name: 'Scan a barcode', exact: true }).click();
	await page.getByRole('button', { name: 'This trip' }).click();
}

test.describe('shopping trip basket', () => {
	test.beforeEach(async ({ page }) => {
		await installFakeCamera(page);
		await page.goto('/');
		await enableShoppingMode(page);
		await seedTrip(page, ['nestle', 'coop', 'migros']);
		await openTrip(page);
	});

	test('lists what was scanned with an average', async ({ page }) => {
		const trip = page.locator('section').filter({ hasText: 'This trip' });
		await expect(trip).toContainText('3 scanned');
		await expect(trip).toContainText('Nestlé');
		await expect(trip).toContainText('Coop');
	});

	test('removing an item updates the average and survives a reload', async ({ page }) => {
		const trip = page.locator('section').filter({ hasText: 'This trip' });
		await page.getByRole('button', { name: /Remove Nestlé/ }).click();
		await expect(trip).toContainText('2 scanned');

		await openTrip(page);
		await expect(trip).toContainText('2 scanned');
		await expect(trip).not.toContainText('Nestlé');
	});

	test('clearing empties the basket', async ({ page }) => {
		await page.getByRole('button', { name: 'Clear' }).click();
		await expect(page.getByText('Nothing scanned yet.')).toBeVisible();
	});

	test('an item links to its company page', async ({ page }) => {
		await page.getByRole('link', { name: 'Nestlé' }).click();
		await expect(page).toHaveURL(/\/brand\/nestle$/);
	});

	test('a trip older than the 4h gap does not come back', async ({ page }) => {
		await page.evaluate(() => {
			const stale = Date.now() - 5 * 60 * 60 * 1000;
			localStorage.setItem('ocs-scan-trip', JSON.stringify([{ companyId: 'nestle', at: stale }]));
		});
		await openTrip(page);
		await expect(page.getByText('Nothing scanned yet.')).toBeVisible();
	});

	test('an empty basket explains itself before anything is scanned', async ({ page }) => {
		await page.evaluate(() => localStorage.removeItem('ocs-scan-trip'));
		await openTrip(page);
		await expect(page.getByText('Nothing scanned yet.')).toBeVisible();
		await expect(page.getByText(/scanned · average/)).toBeHidden();
	});

	test('going back to scanning hides the basket', async ({ page }) => {
		await page.getByRole('button', { name: 'Back to scanning' }).click();
		await expect(page.getByText('Point at a product barcode')).toBeVisible();
	});
});
