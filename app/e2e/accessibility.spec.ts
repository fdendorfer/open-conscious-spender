import { expect, test } from '@playwright/test';
import { mockOpenFacts, openScanner, showBarcode, waitForDataset } from './helpers';

test.describe('keyboard and screen reader', () => {
	test('the skip link is the first tab stop and moves focus to the content', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: 'Skip to content' });
		await expect(skip).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('#main')).toBeFocused();
	});

	test('the scanner keeps focus inside and hands it back on close', async ({ page }) => {
		await openScanner(page);
		const scanner = page.getByRole('dialog', { name: 'Barcode scanner' });
		await expect(scanner).toBeVisible();
		await expect(
			page.getByRole('status').filter({ hasText: 'Point at a product barcode' })
		).toBeFocused();

		for (let i = 0; i < 8; i++) {
			await page.keyboard.press('Tab');
			// Past the last control focus may leave for the browser UI, never for the page behind.
			const inside = await scanner.evaluate(
				(el) => document.activeElement === document.body || el.contains(document.activeElement)
			);
			expect(inside).toBe(true);
		}

		await page.keyboard.press('Escape');
		await expect(scanner).toBeHidden();
		await expect(page.getByRole('button', { name: 'Scan a barcode', exact: true })).toBeFocused();
	});

	test('a scan result takes focus so it is read out', async ({ page }) => {
		await mockOpenFacts(page, { '7613035000001': { brands: 'KitKat' } });
		await openScanner(page);
		await showBarcode(page, '7613035000001');
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeFocused();
	});

	test('the rating request form takes focus and reports errors on its field', async ({ page }) => {
		await page.goto('/');
		await waitForDataset(page);
		const search = page.getByRole('main').getByRole('combobox', { name: 'Search companies' });
		await search.fill('Zzyzx Brand');
		await search.press('Enter');
		await expect(page.getByRole('heading', { name: 'Not rated yet' })).toBeFocused();

		const name = page.getByRole('textbox', { name: 'Brand or company name' });
		await name.fill('');
		await page.getByRole('button', { name: 'Request a rating' }).click();
		await expect(page.getByRole('alert')).toHaveText('A brand name is required.');
		await expect(name).toHaveAttribute('aria-invalid', 'true');
		await expect(name).toHaveAccessibleDescription('A brand name is required.');

		await page.getByRole('button', { name: /I already have a source/ }).click();
		await expect(page.getByRole('form', { name: 'Add the details yourself' })).toBeFocused();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
	});

	test('clearing device data keeps focus on the confirmation flow', async ({ page }) => {
		await page.goto('/settings');
		const cancel = page.getByRole('button', { name: 'Cancel' });
		// Retried because the prerendered button can be clicked before it hydrates.
		await expect(async () => {
			await page.getByRole('button', { name: 'Clear everything on this device' }).click();
			await expect(cancel).toBeVisible({ timeout: 500 });
		}).toPass();
		await expect(cancel).toBeFocused();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(
			page.getByRole('button', { name: 'Clear everything on this device' })
		).toBeFocused();
	});

	test('navigating moves focus to the new page content', async ({ page }) => {
		await page.goto('/');
		await waitForDataset(page);
		await page.getByRole('main').getByRole('combobox').fill('KitKat');
		await page.getByRole('option').first().click();
		await expect(page).toHaveURL(/\/brand\//);
		await expect(page.locator('#main')).toBeFocused();
	});

	test('opening the mobile menu moves focus into it', async ({ page }) => {
		await page.goto('/');
		await waitForDataset(page);
		await page.getByRole('button', { name: 'Navigation menu' }).tap();
		const current = page.locator('#nav-menu [aria-current="page"]');
		await expect(current).toBeFocused();
		const links = page.locator('#nav-menu a');
		await expect(links.first()).toHaveAttribute('tabindex', '0');
		await page.keyboard.press('ArrowDown');
		await expect(links.nth(1)).toBeFocused();
		await page.keyboard.press('End');
		await expect(page.locator('#nav-menu').locator('a, button').last()).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(links.first()).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'Navigation menu' })).toBeFocused();

		// Tabbing out either way closes the menu instead of leaving it open behind focus.
		const menu = page.locator('#nav-menu');
		await page.getByRole('button', { name: 'Navigation menu' }).press('Enter');
		await expect(menu).toBeVisible();
		await page.keyboard.press('End');
		await page.keyboard.press('Tab');
		await expect(menu).toBeHidden();
		await expect(page.getByRole('button', { name: 'Search companies' })).toBeFocused();

		await page.getByRole('button', { name: 'Navigation menu' }).press('Enter');
		await expect(menu).toBeVisible();
		await page.keyboard.press('Shift+Tab');
		await page.keyboard.press('Shift+Tab');
		await expect(menu).toBeHidden();
	});

	test('a request shows a sending state and keeps focus while pending', async ({ page }) => {
		let release!: () => void;
		const pending = new Promise<void>((r) => (release = r));
		await page.route('https://pr-bot.test/request/brand', async (route) => {
			await pending;
			await route.fulfill({
				json: { issueUrl: 'https://github.com/x/y/issues/1', requestCount: 1 }
			});
		});
		await page.goto('/?add=Zzyzx');
		await expect(page.getByText('* Required')).toBeVisible();
		const submit = page.getByRole('button', { name: 'Request a rating' });
		await submit.focus();
		await page.keyboard.press('Enter');
		const sending = page.getByRole('button', { name: 'Sending…' });
		await expect(sending).toHaveAttribute('aria-disabled', 'true');
		await expect(sending).toBeFocused();
		release();
		await expect(page.getByText(/is on the list/)).toBeFocused();
	});

	test('search results show the score', async ({ page }) => {
		await page.goto('/');
		await waitForDataset(page);
		await page.getByRole('main').getByRole('combobox').fill('KitKat');
		await expect(page.getByRole('option').first()).toContainText(/-?\d+$/);
	});
});
