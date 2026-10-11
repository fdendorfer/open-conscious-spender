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

/**
 * Replaces the camera with a canvas stream, so scans run through the real
 * BarcodeDetector path. Call before navigating; show codes with {@link showBarcode}.
 */
export async function installFakeCamera(page: Page) {
	await page.addInitScript(() => {
		const L = [
			'0001101',
			'0011001',
			'0010011',
			'0111101',
			'0100011',
			'0110001',
			'0101111',
			'0111011',
			'0110111',
			'0001011'
		];
		const PARITY = [
			'LLLLLL',
			'LLGLGG',
			'LLGGLG',
			'LLGGGL',
			'LGLLGG',
			'LGGLLG',
			'LGGGLL',
			'LGLGLG',
			'LGLGGL',
			'LGGLGL'
		];
		const R = L.map((code) => [...code].map((bit) => (bit === '0' ? '1' : '0')).join(''));
		const G = R.map((code) => [...code].reverse().join(''));

		const canvas = document.createElement('canvas');
		canvas.width = 640;
		canvas.height = 480;
		const ctx = canvas.getContext('2d')!;
		let bits = '';

		function draw() {
			ctx.fillStyle = '#fff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = '#000';
			const module = 4;
			const left = (canvas.width - bits.length * module) / 2;
			[...bits].forEach((bit, i) => {
				if (bit === '1') ctx.fillRect(left + i * module, 140, module, 200);
			});
		}
		// captureStream only emits frames when the canvas changes.
		setInterval(draw, 100);

		(window as unknown as { __showBarcode: (gtin: string) => void }).__showBarcode = (gtin) => {
			const d = [...gtin].map(Number);
			const leftHalf = d
				.slice(1, 7)
				.map((n, i) => (PARITY[d[0]][i] === 'L' ? L[n] : G[n]))
				.join('');
			const rightHalf = d
				.slice(7)
				.map((n) => R[n])
				.join('');
			bits = '101' + leftHalf + '01010' + rightHalf + '101';
		};

		const stream = canvas.captureStream(10);
		navigator.mediaDevices.getUserMedia = async () => stream;
	});
}

/** Puts an EAN-13 barcode in front of the fake camera. */
export async function showBarcode(page: Page, gtin: string) {
	await page.evaluate((code) => {
		(window as unknown as { __showBarcode: (gtin: string) => void }).__showBarcode(code);
	}, gtin);
}

/** Starts shopping mode with the intro already seen and waits for the camera to be scanning. */
export async function openScanner(page: Page) {
	await installFakeCamera(page);
	await page.goto('/');
	await enableShoppingMode(page);
	await page.reload();
	await waitForDataset(page);
	await page.getByRole('button', { name: 'Scan a barcode', exact: true }).click();
	await page.getByText('Point at a product barcode').waitFor();
}
