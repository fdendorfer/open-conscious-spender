import { expect, test } from '@playwright/test';
import { seedTrip } from './helpers';

test.describe('shopping trip basket', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/shopping');
		await seedTrip(page, ['nestle', 'coop', 'migros']);
		await page.reload();
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

		await page.reload();
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
		await page.reload();
		await expect(page.getByText('Nothing scanned yet.')).toBeVisible();
	});

	test('an empty basket explains itself before anything is scanned', async ({ page }) => {
		await page.evaluate(() => localStorage.removeItem('ocs-scan-trip'));
		await page.reload();
		await expect(page.getByText('Nothing scanned yet.')).toBeVisible();
		await expect(page.getByText(/scanned · average/)).toBeHidden();
	});
});
