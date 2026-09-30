import { expect, test } from '@playwright/test';
import { waitForDataset } from './helpers';

test.describe('name search', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await waitForDataset(page);
	});

	test('finds a company by one of its brands', async ({ page }) => {
		await page.getByRole('main').getByRole('combobox').fill('KitKat');
		const option = page.getByRole('option').first();
		await expect(option).toContainText('KitKat');
		await expect(option).toContainText('Nestlé');

		await option.click();
		await expect(page).toHaveURL(/\/brand\/nestle$/);
		await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
	});

	test('matches without accents or punctuation', async ({ page }) => {
		await page.getByRole('main').getByRole('combobox').fill('loreal');
		await expect(page.getByRole('option').first()).toContainText("L'Oréal");
	});

	test('offers a rating request when nothing matches', async ({ page }) => {
		await page.getByRole('main').getByRole('combobox').fill('Zzzznotacompany');
		await page.getByRole('button', { name: /Request a rating for/ }).click();

		await expect(page.getByRole('heading', { name: 'Not rated yet' })).toBeVisible();
		await expect(page.getByLabel('Brand or company name')).toHaveValue('Zzzznotacompany');
	});

	test('keyboard drives the combobox', async ({ page }) => {
		const box = page.getByRole('main').getByRole('combobox');
		await box.fill('co');
		await box.press('ArrowDown');
		await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
		await box.press('Enter');
		await expect(page).toHaveURL(/\/brand\//);
	});

	test('remembers what was opened and offers it on an empty box', async ({ page }) => {
		await page.getByRole('main').getByRole('combobox').fill('Nestlé');
		await page.getByRole('option').first().click();
		await expect(page).toHaveURL(/\/brand\/nestle$/);

		await page.goto('/');
		await waitForDataset(page);
		await page.getByRole('main').getByRole('combobox').click();
		await expect(page.getByText('Recent searches')).toBeVisible();
		await expect(page.getByRole('option').first()).toContainText('Nestlé');
	});
});

test.describe('nav bar search', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await waitForDataset(page);
		await page.getByRole('button', { name: 'Search companies' }).click();
	});

	test('opens a company from the dialog', async ({ page }) => {
		await page.getByRole('dialog').getByRole('combobox').fill('Nestlé');
		await page.getByRole('option').first().click();
		await expect(page).toHaveURL(/\/brand\/nestle$/);
	});

	test('hands an unrated brand to the request form', async ({ page }) => {
		await page.getByRole('dialog').getByRole('combobox').fill('Zzzznotacompany');
		await page.getByRole('button', { name: /Request a rating for/ }).click();

		await expect(page).toHaveURL(/\?add=Zzzznotacompany/);
		await expect(page.getByRole('heading', { name: 'Not rated yet' })).toBeVisible();
		await expect(page.getByLabel('Brand or company name')).toHaveValue('Zzzznotacompany');
	});

	// Regression: replaceState() left page.url stale, so the second request was a no-op.
	test('the same brand can be requested twice in a row', async ({ page }) => {
		await page.getByRole('dialog').getByRole('combobox').fill('Zzzznotacompany');
		await page.getByRole('button', { name: /Request a rating for/ }).click();
		await expect(page.getByRole('heading', { name: 'Not rated yet' })).toBeVisible();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page).toHaveURL(/\/$/);

		await page.getByRole('button', { name: 'Search companies' }).click();
		await page.getByRole('dialog').getByRole('combobox').fill('Zzzznotacompany');
		await page.getByRole('button', { name: /Request a rating for/ }).click();
		await expect(page.getByRole('heading', { name: 'Not rated yet' })).toBeVisible();
	});
});
