import { expect, test, type Page } from '@playwright/test';
import { enableShoppingMode, failOpenFacts, mockOpenFacts, waitForDataset } from './helpers';

// The headless browser has no camera, so the overlay falls back to its manual
// barcode field — the same lookup path a real scan takes, minus the decode.
async function openScanner(page: Page) {
	await page.goto('/');
	await enableShoppingMode(page);
	await page.reload();
	await waitForDataset(page);
	await page.getByRole('button', { name: 'Scan a barcode' }).click();
	await page.getByPlaceholder('Barcode number…').waitFor();
}

async function lookUp(page: Page, gtin: string) {
	await page.getByPlaceholder('Barcode number…').fill(gtin);
	await page.getByRole('button', { name: 'Look up' }).click();
}

test.describe('barcode lookup', () => {
	test('a known brand resolves to its owner', async ({ page }) => {
		await mockOpenFacts(page, {
			'7613035000001': { brands: 'KitKat', product_name: 'KitKat 4 Finger' }
		});
		await openScanner(page);
		await lookUp(page, '7613035000001');

		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Scan next item' })).toBeVisible();
	});

	test('an unlisted brand offers a rating request', async ({ page }) => {
		await mockOpenFacts(page, { '5000000000000': { brands: 'Unlisted Co' } });
		await openScanner(page);
		await lookUp(page, '5000000000000');

		await expect(page.getByRole('heading', { name: 'Unlisted Co' })).toBeVisible();
		await page.getByRole('button', { name: 'Request a rating' }).click();
		await expect(page).toHaveURL(/\?add=Unlisted\+Co&gtin=5000000000000/);
		await expect(page.getByLabel('Brand or company name')).toHaveValue('Unlisted Co');
	});

	test('a barcode no database knows reports no match', async ({ page }) => {
		await mockOpenFacts(page, {});
		await openScanner(page);
		await lookUp(page, '9999999999999');
		await expect(page.getByRole('heading', { name: 'No match' })).toBeVisible();
	});

	test('a second scan of the same product skips the network', async ({ page }) => {
		const facts = await mockOpenFacts(page, { '7613035000001': { brands: 'KitKat' } });
		await openScanner(page);
		await lookUp(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
		const afterFirst = facts.count();

		await page.getByRole('button', { name: 'Scan next item' }).click();
		await lookUp(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
		expect(facts.count()).toBe(afterFirst);
	});

	test('a cached product still resolves with no connection', async ({ page, context }) => {
		await mockOpenFacts(page, { '7613035000001': { brands: 'KitKat' } });
		await openScanner(page);
		await lookUp(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();

		await context.setOffline(true);
		await page.getByRole('button', { name: 'Scan next item' }).click();
		await lookUp(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
	});

	test('an uncached barcode with no connection says offline, and retries', async ({
		page,
		context
	}) => {
		await mockOpenFacts(page, { '7613035000001': { brands: 'KitKat' } });
		await openScanner(page);
		await context.setOffline(true);
		await lookUp(page, '7613035000001');

		await expect(page.getByRole('heading', { name: 'Offline' })).toBeVisible();

		await context.setOffline(false);
		await page.getByRole('button', { name: 'Try again' }).click();
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
	});

	test('a failing Open Facts API is a miss, not a crash', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await failOpenFacts(page);
		await openScanner(page);
		await lookUp(page, '7613035000001');

		await expect(page.getByRole('heading', { name: 'No match' })).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('closing the overlay leaves shopping mode on', async ({ page }) => {
		await openScanner(page);
		await page.getByRole('button', { name: 'Close camera' }).click();
		await expect(page.getByRole('button', { name: 'Scan a barcode' })).toBeVisible();
	});

	test('"exit shopping mode" turns the camera button back into search', async ({ page }) => {
		await openScanner(page);
		await page.getByRole('button', { name: 'Exit shopping mode', exact: true }).last().click();
		await expect(page.getByRole('button', { name: 'Search companies' })).toBeVisible();
	});
});
