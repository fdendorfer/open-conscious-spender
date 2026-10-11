import { expect, test } from '@playwright/test';
import {
	failOpenFacts,
	installFakeCamera,
	mockOpenFacts,
	openScanner,
	showBarcode,
	waitForDataset
} from './helpers';

test.describe('barcode lookup', () => {
	test('a known brand resolves to its owner', async ({ page }) => {
		await mockOpenFacts(page, {
			'7613035000001': { brands: 'KitKat', product_name: 'KitKat 4 Finger' }
		});
		await openScanner(page);
		await showBarcode(page, '7613035000001');

		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Scan next item' })).toBeVisible();
	});

	test('an unlisted brand offers a rating request', async ({ page }) => {
		await mockOpenFacts(page, { '5000000000005': { brands: 'Unlisted Co' } });
		await openScanner(page);
		await showBarcode(page, '5000000000005');

		await expect(page.getByRole('heading', { name: 'Unlisted Co' })).toBeVisible();
		await page.getByRole('button', { name: 'Request a rating' }).click();
		await expect(page).toHaveURL(/\?add=Unlisted\+Co&gtin=5000000000005/);
		await expect(page.getByLabel('Brand or company name')).toHaveValue('Unlisted Co');
	});

	test('a barcode no database knows reports no match', async ({ page }) => {
		await mockOpenFacts(page, {});
		await openScanner(page);
		await showBarcode(page, '9999999999994');
		await expect(page.getByRole('heading', { name: 'No match' })).toBeVisible();
	});

	test('a second scan of the same product skips the network', async ({ page }) => {
		const facts = await mockOpenFacts(page, { '7613035000001': { brands: 'KitKat' } });
		await openScanner(page);
		await showBarcode(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
		const afterFirst = facts.count();

		await page.getByRole('button', { name: 'Scan next item' }).click();
		await showBarcode(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
		expect(facts.count()).toBe(afterFirst);
	});

	test('a cached product still resolves with no connection', async ({ page, context }) => {
		await mockOpenFacts(page, { '7613035000001': { brands: 'KitKat' } });
		await openScanner(page);
		await showBarcode(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();

		await context.setOffline(true);
		await page.getByRole('button', { name: 'Scan next item' }).click();
		await showBarcode(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
	});

	test('an uncached barcode with no connection says offline, and retries', async ({
		page,
		context
	}) => {
		await mockOpenFacts(page, { '7613035000001': { brands: 'KitKat' } });
		await openScanner(page);
		await context.setOffline(true);
		await showBarcode(page, '7613035000001');

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
		await showBarcode(page, '7613035000001');

		await expect(page.getByRole('heading', { name: 'No match' })).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('closing the overlay leaves shopping mode on', async ({ page }) => {
		await openScanner(page);
		await page.getByRole('button', { name: 'Close camera' }).click();
		await expect(page.getByRole('button', { name: 'Scan a barcode', exact: true })).toBeVisible();
	});

	test('"exit shopping mode" turns the camera button back into search', async ({ page }) => {
		await openScanner(page);
		await page.getByRole('button', { name: 'Exit shopping mode', exact: true }).last().click();
		await expect(page.getByRole('button', { name: 'Search companies' })).toBeVisible();
	});
});

test.describe('shopping mode intro', () => {
	test('first start explains the camera before asking for it', async ({ page }) => {
		await installFakeCamera(page);
		await page.goto('/');
		await waitForDataset(page);
		await page.getByRole('button', { name: /Already in the shop/ }).click();

		const intro = page.getByRole('dialog', { name: 'Shopping mode' });
		await expect(intro).toBeVisible();
		await intro.getByRole('button', { name: 'Start scanning' }).click();
		await expect(page.getByText('Point at a product barcode')).toBeVisible();

		await page.getByRole('button', { name: 'Close camera' }).click();
		await page.getByRole('button', { name: 'Scan a barcode', exact: true }).click();
		await expect(page.getByText('Point at a product barcode')).toBeVisible();
		await expect(intro).toBeHidden();
	});

	test('the info button shows the intro again and returns to scanning', async ({ page }) => {
		await openScanner(page);
		await page.getByRole('button', { name: 'How it works' }).click();
		const intro = page.getByRole('dialog', { name: 'Shopping mode' });
		await expect(intro).toBeVisible();

		await intro.getByRole('button', { name: 'Back to scanning' }).click();
		await expect(intro).toBeHidden();
		await expect(page.getByText('Point at a product barcode')).toBeVisible();
	});

	test('there is no manual barcode entry', async ({ page }) => {
		await openScanner(page);
		await expect(page.getByPlaceholder('Barcode number…')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Look up' })).toHaveCount(0);
	});
});
