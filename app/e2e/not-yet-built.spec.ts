/**
 * Features that are wanted but not built (see docs/TODO.md and docs/ROADMAP.md).
 *
 * Each test is written against the intended behaviour and marked `fixme`, so it
 * is a specification rather than a wish: unskip it when the feature lands, and
 * Playwright reports "passed unexpectedly" if a skipped one starts working.
 */
import { expect, test, type Page } from '@playwright/test';
import { enableShoppingMode, mockOpenFacts, seedTrip, waitForDataset } from './helpers';

async function openScanner(page: Page) {
	await page.goto('/');
	await enableShoppingMode(page);
	await page.reload();
	await waitForDataset(page);
	await page.getByRole('button', { name: 'Scan a barcode' }).click();
	await page.getByPlaceholder('Barcode number…').waitFor();
}

// data/products/barcode-overrides.json ships empty, so nothing resolves without
// a connection today. The offline promise in the UI copy depends on this.
test.fixme('a community barcode override resolves with no connection', async ({
	page,
	context
}) => {
	await page.goto('/');
	await waitForDataset(page);
	await enableShoppingMode(page);
	await context.setOffline(true);
	await page.reload();

	await page.getByRole('button', { name: 'Scan a barcode' }).click();
	await page.getByPlaceholder('Barcode number…').fill('7610807000123');
	await page.getByRole('button', { name: 'Look up' }).click();

	await expect(page.getByRole('heading', { name: 'Nestlé' })).toBeVisible();
});

// The Worker already accepts /submit/barcode; no screen reaches it.
test.fixme('a scan miss can contribute the barcode mapping itself', async ({ page }) => {
	await mockOpenFacts(page, { '5000000000000': { brands: 'Unlisted Co' } });
	await openScanner(page);
	await page.getByPlaceholder('Barcode number…').fill('5000000000000');
	await page.getByRole('button', { name: 'Look up' }).click();

	await page.getByRole('button', { name: /I know who owns this/ }).click();
	await page.getByRole('combobox', { name: /owner/i }).fill('Nestlé');
	await page.getByRole('option').first().click();
	await page.getByRole('button', { name: /Submit mapping/ }).click();
	await expect(page.getByText(/pull request/i)).toBeVisible();
});

// Roadmap: needs a product category on companies, which the schema lacks.
test.fixme('a poor score suggests a better-rated alternative', async ({ page }) => {
	await page.goto('/brand/nestle');
	const alternatives = page.getByRole('region', { name: /alternatives/i });
	await expect(alternatives).toBeVisible();
	await expect(alternatives.getByRole('link')).not.toHaveCount(0);
});

// Roadmap: trips reset after a 4h gap and are then gone for good.
test.fixme('past trips are kept and can be reviewed', async ({ page }) => {
	await page.goto('/shopping');
	await seedTrip(page, ['nestle', 'coop']);
	await page.evaluate(() => {
		const old = Date.now() - 5 * 60 * 60 * 1000;
		localStorage.setItem(
			'ocs-trip-history',
			JSON.stringify([{ endedAt: old, companyIds: ['migros'] }])
		);
	});
	await page.reload();

	await page.getByRole('link', { name: /past trips/i }).click();
	await expect(page.getByText('Migros')).toBeVisible();
});

// Roadmap: decayMultiplier is read by the scoring formula but never set.
test.fixme('an old flag is visibly aged and weighs less', async ({ page }) => {
	await page.goto('/brand/nestle');
	const flag = page.getByRole('listitem').filter({ hasText: 'boycott' }).first();
	await expect(flag).toContainText(/2\d{3}/); // the year the flag is from
	await expect(flag.getByTitle(/weight reduced/i)).toBeVisible();
});

test.fixme('a trip can be shared or exported', async ({ page }) => {
	await page.goto('/shopping');
	await seedTrip(page, ['nestle', 'coop']);
	await page.reload();
	await expect(page.getByRole('button', { name: /share|export/i })).toBeVisible();
});

test.fixme('the ranking can be filtered by flag category', async ({ page }) => {
	await page.goto('/companies');
	await page.getByRole('button', { name: 'Environment' }).click();
	await expect(page).toHaveURL(/category=environment/);
});

test.fixme('the settings page reports how stale the dataset is', async ({ page }) => {
	await page.goto('/settings');
	await expect(page.getByText(/updated .* ago/i)).toBeVisible();
});
