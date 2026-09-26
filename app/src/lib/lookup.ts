import {
	findCompanyByBarcode,
	findCompanyByBrandName,
	type Company,
	type Dataset
} from './dataset';
import { cacheProduct, readCachedProduct } from './barcodeCache';
import { lookupOpenFoodFacts, type OffProduct } from './openFoodFacts';

export type LookupResult =
	| { status: 'found'; company: Company; via: 'barcode-override' | 'brand-match' | 'name-search' }
	| { status: 'unknown-brand'; brand: string; productName: string | null }
	| { status: 'not-found' }
	| { status: 'offline' };

/** Cached answer if there is one, otherwise the network — and remember what it said. */
async function resolveProduct(gtin: string): Promise<OffProduct | null> {
	const cached = await readCachedProduct(gtin);
	if (cached !== undefined) return cached;

	const product = await lookupOpenFoodFacts(gtin);
	await cacheProduct(gtin, product);
	return product;
}

/**
 * Resolves a scanned barcode to a company:
 * 1. community-maintained barcode -> company override (fastest, works offline)
 * 2. Open Facts brand lookup (device-cached), matched against company name/aliases
 */
export async function lookupBarcode(dataset: Dataset, gtin: string): Promise<LookupResult> {
	const overrideMatch = findCompanyByBarcode(dataset, gtin);
	if (overrideMatch) return { status: 'found', company: overrideMatch, via: 'barcode-override' };

	const cached = await readCachedProduct(gtin);
	// Distinguishable from a miss: offline means "ask again later", not "unknown".
	if (cached === undefined && typeof navigator !== 'undefined' && navigator.onLine === false) {
		return { status: 'offline' };
	}

	const product = cached === undefined ? await resolveProduct(gtin) : cached;
	if (!product?.brand) return { status: 'not-found' };

	const brandMatch = findCompanyByBrandName(dataset, product.brand);
	if (brandMatch) return { status: 'found', company: brandMatch, via: 'brand-match' };

	return { status: 'unknown-brand', brand: product.brand, productName: product.productName };
}
