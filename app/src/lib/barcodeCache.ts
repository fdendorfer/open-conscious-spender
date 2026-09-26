import { del, get, set } from 'idb-keyval';
import type { OffProduct } from './openFoodFacts';

const KEY_PREFIX = 'ocs-barcode-';

// A product's brand does not change, so hits can be kept indefinitely. Misses
// expire, because "not in Open Food Facts yet" is a state that gets fixed.
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
	product: OffProduct | null;
	at: number;
}

const key = (gtin: string) => `${KEY_PREFIX}${gtin}`;

/**
 * Remembers what the Open Facts databases said about a barcode, so re-scanning
 * a product resolves offline and without a round trip. The company is not
 * cached — only the brand — so a dataset update is picked up on the next scan.
 *
 * Returns `undefined` when nothing is known, `null` when the lookup is a known miss.
 */
export async function readCachedProduct(gtin: string): Promise<OffProduct | null | undefined> {
	try {
		const entry = await get<CacheEntry>(key(gtin));
		if (!entry) return undefined;
		if (!entry.product && Date.now() - entry.at > MISS_TTL_MS) {
			await del(key(gtin));
			return undefined;
		}
		return entry.product;
	} catch {
		return undefined; // IndexedDB blocked — fall through to the network
	}
}

export async function cacheProduct(gtin: string, product: OffProduct | null): Promise<void> {
	try {
		await set(key(gtin), { product, at: Date.now() } satisfies CacheEntry);
	} catch {
		// IndexedDB blocked (private mode) — lookups just stay online-only
	}
}
