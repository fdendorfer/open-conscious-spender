import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheProduct, readCachedProduct } from './barcodeCache';

const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
	get: vi.fn(async (key: string) => store.get(key)),
	set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
	del: vi.fn(async (key: string) => void store.delete(key))
}));

const product = { brand: 'Nestlé', productName: 'KitKat', source: 'Open Food Facts' };

beforeEach(() => {
	store.clear();
	vi.useRealTimers();
});

describe('barcodeCache', () => {
	it('distinguishes "never looked up" from "looked up, not found"', async () => {
		expect(await readCachedProduct('123')).toBeUndefined();
		await cacheProduct('123', null);
		expect(await readCachedProduct('123')).toBeNull();
	});

	it('returns a cached hit', async () => {
		await cacheProduct('123', product);
		expect(await readCachedProduct('123')).toEqual(product);
	});

	it('keeps hits indefinitely but expires misses', async () => {
		vi.useFakeTimers();
		await cacheProduct('hit', product);
		await cacheProduct('miss', null);

		vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

		expect(await readCachedProduct('hit')).toEqual(product);
		expect(await readCachedProduct('miss')).toBeUndefined();
	});

	it('reports nothing cached when IndexedDB is blocked', async () => {
		const { get } = await import('idb-keyval');
		vi.mocked(get).mockRejectedValueOnce(new Error('blocked'));
		expect(await readCachedProduct('123')).toBeUndefined();
	});
});
