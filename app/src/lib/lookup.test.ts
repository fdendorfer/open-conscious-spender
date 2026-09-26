import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupBarcode } from './lookup';

const cacheStore = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
	get: vi.fn(async (key: string) => cacheStore.get(key)),
	set: vi.fn(async (key: string, value: unknown) => void cacheStore.set(key, value)),
	del: vi.fn(async (key: string) => void cacheStore.delete(key))
}));

import type { Company, Dataset } from './dataset';

function company(id: string, overrides: Partial<Company> = {}): Company {
	return {
		id,
		name: id,
		aliases: [],
		brands: [],
		country: 'CH',
		parentId: null,
		wikidataId: null,
		flags: [],
		...overrides
	};
}

const dataset: Dataset = {
	version: 'test',
	categories: [],
	companies: [company('nestle', { name: 'Nestlé', brands: ['KitKat'] })],
	barcodeOverrides: { '7610807000123': 'nestle' }
};

/** Answers only for `hosts`; every other Open Facts host reports "not found". */
function mockFacts(hosts: Record<string, { product_name?: string; brands?: string }>) {
	return vi.fn(async (url: string | URL) => {
		const href = String(url);
		const match = Object.entries(hosts).find(([host]) => href.includes(host));
		if (!match) return new Response(JSON.stringify({ status: 0 }), { status: 200 });
		return new Response(JSON.stringify({ status: 1, product: match[1] }), { status: 200 });
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	cacheStore.clear();
});

describe('lookupBarcode', () => {
	it('prefers the local override and never touches the network', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		const result = await lookupBarcode(dataset, '7610807000123');

		expect(result).toMatchObject({ status: 'found', via: 'barcode-override' });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('falls back to a brand match from Open Food Facts', async () => {
		vi.stubGlobal(
			'fetch',
			mockFacts({ openfoodfacts: { brands: 'KitKat', product_name: 'KitKat 4F' } })
		);

		const result = await lookupBarcode(dataset, '9999999999999');

		expect(result).toMatchObject({ status: 'found', via: 'brand-match' });
		expect(result.status === 'found' && result.company.id).toBe('nestle');
	});

	it('takes the first brand when the API returns a comma-separated list', async () => {
		vi.stubGlobal(
			'fetch',
			mockFacts({ openfoodfacts: { brands: 'KitKat, Nestlé, Confectionery' } })
		);

		const result = await lookupBarcode(dataset, '9999999999999');
		expect(result.status).toBe('found');
	});

	it('reports an unknown brand rather than a blank miss', async () => {
		vi.stubGlobal(
			'fetch',
			mockFacts({ openfoodfacts: { brands: 'Unlisted Co', product_name: 'Thing' } })
		);

		const result = await lookupBarcode(dataset, '9999999999999');

		expect(result).toEqual({ status: 'unknown-brand', brand: 'Unlisted Co', productName: 'Thing' });
	});

	it('finds cosmetics via Open Beauty Facts when Food does not know the code', async () => {
		const beauty: Dataset = {
			...dataset,
			companies: [company('loreal', { name: "L'Oréal", brands: ['Maybelline'] })]
		};
		vi.stubGlobal('fetch', mockFacts({ openbeautyfacts: { brands: 'Maybelline' } }));

		const result = await lookupBarcode(beauty, '9999999999999');

		expect(result).toMatchObject({ status: 'found', via: 'brand-match' });
	});

	it('falls through to Open Products Facts as a last resort', async () => {
		const other: Dataset = {
			...dataset,
			companies: [company('ikea', { name: 'IKEA', brands: ['BILLY'] })]
		};
		vi.stubGlobal('fetch', mockFacts({ openproductsfacts: { brands: 'BILLY' } }));

		const result = await lookupBarcode(other, '9999999999999');
		expect(result).toMatchObject({ status: 'found', via: 'brand-match' });
	});

	it('reports not-found when no source knows the code', async () => {
		vi.stubGlobal('fetch', mockFacts({}));
		expect(await lookupBarcode(dataset, '9999999999999')).toEqual({ status: 'not-found' });
	});

	it('treats a network failure as not-found rather than throwing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('offline');
			})
		);
		expect(await lookupBarcode(dataset, '9999999999999')).toEqual({ status: 'not-found' });
	});

	it('treats a non-OK response as not-found', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('nope', { status: 500 }))
		);
		expect(await lookupBarcode(dataset, '9999999999999')).toEqual({ status: 'not-found' });
	});
});

describe('lookupBarcode caching', () => {
	beforeEach(() => cacheStore.clear());

	it('reuses a cached product instead of going back to the network', async () => {
		const fetchSpy = mockFacts({ openfoodfacts: { brands: 'KitKat' } });
		vi.stubGlobal('fetch', fetchSpy);

		await lookupBarcode(dataset, '9999999999999');
		const callsAfterFirst = fetchSpy.mock.calls.length;
		const second = await lookupBarcode(dataset, '9999999999999');

		expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
		expect(second).toEqual({ status: 'found', company: dataset.companies[0], via: 'brand-match' });
	});

	it('reports offline rather than not-found when nothing is cached', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		vi.stubGlobal('navigator', { onLine: false });

		expect(await lookupBarcode(dataset, '9999999999999')).toEqual({ status: 'offline' });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('answers offline from the cache when the barcode was seen before', async () => {
		vi.stubGlobal('fetch', mockFacts({ openfoodfacts: { brands: 'KitKat' } }));
		await lookupBarcode(dataset, '9999999999999');

		vi.stubGlobal('navigator', { onLine: false });
		vi.stubGlobal(
			'fetch',
			vi.fn(() => {
				throw new Error('offline');
			})
		);

		expect(await lookupBarcode(dataset, '9999999999999')).toEqual({
			status: 'found',
			company: dataset.companies[0],
			via: 'brand-match'
		});
	});

	it('queries every Open Facts source at once but answers in priority order', async () => {
		const fetchSpy = mockFacts({
			openfoodfacts: { brands: 'KitKat' },
			openbeautyfacts: { brands: 'Unlisted Co' }
		});
		vi.stubGlobal('fetch', fetchSpy);

		const result = await lookupBarcode(dataset, '9999999999999');

		expect(result).toEqual({ status: 'found', company: dataset.companies[0], via: 'brand-match' });
		expect(fetchSpy.mock.calls.length).toBe(4);
	});
});
