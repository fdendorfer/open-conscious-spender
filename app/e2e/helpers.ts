import type { Page, Route } from '@playwright/test';

/** Open Facts hosts the app queries, in the order lookup.ts prefers them. */
const FACTS_HOSTS = [
	'world.openfoodfacts.org',
	'world.openbeautyfacts.org',
	'world.openpetfoodfacts.org',
	'world.openproductsfacts.org'
];

export interface FactsProduct {
	brands: string;
	product_name?: string;
}

/**
 * Answers the Open Facts APIs from a fixture instead of the network, keyed by
 * GTIN. An unlisted GTIN gets the real API's "not found" shape. Returns the
 * request count so a test can assert the device cache stopped the second call.
 */
export async function mockOpenFacts(
	page: Page,
	products: Record<string, FactsProduct>,
	options: { host?: string } = {}
): Promise<{ count: () => number }> {
	let count = 0;
	const hosts = options.host ? [options.host] : FACTS_HOSTS;

	for (const host of FACTS_HOSTS) {
		await page.route(`https://${host}/api/v2/product/*`, (route: Route) => {
			count++;
			const gtin = new URL(route.request().url()).pathname.split('/').pop()?.replace('.json', '');
			const product = hosts.includes(host) && gtin ? products[gtin] : undefined;
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(product ? { status: 1, product } : { status: 0 })
			});
		});
	}

	return { count: () => count };
}

/** Every Open Facts call fails, the way a dead connection behaves. */
export async function failOpenFacts(page: Page) {
	for (const host of FACTS_HOSTS) {
		await page.route(`https://${host}/api/v2/product/*`, (route) => route.abort('failed'));
	}
}

/** Blocks the dataset download, for the "first run with no connection" path. */
export async function failDatasetDownload(page: Page) {
	await page.route('https://raw.githubusercontent.com/**', (route) => route.abort('failed'));
}

export async function seedTrip(page: Page, companyIds: string[]) {
	await page.evaluate((ids) => {
		localStorage.setItem(
			'ocs-scan-trip',
			JSON.stringify(ids.map((companyId, i) => ({ companyId, at: Date.now() - i * 1000 })))
		);
	}, companyIds);
}

export async function enableShoppingMode(page: Page) {
	await page.evaluate(() => {
		localStorage.setItem('ocs-shopping-mode', '1');
		localStorage.setItem('ocs-shopping-intro-seen', '1');
	});
}

/** Waits for the dataset to be in hand — the search box only answers after that. */
export async function waitForDataset(page: Page) {
	await page.getByRole('main').getByRole('combobox').waitFor({ state: 'visible' });
}
