import {
	findCompanyByBarcode,
	findCompanyByBrandName,
	type Company,
	type Dataset
} from './dataset';
import { lookupOpenFoodFacts } from './openFoodFacts';

export type LookupResult =
	| { status: 'found'; company: Company; via: 'barcode-override' | 'brand-match' | 'name-search' }
	| { status: 'unknown-brand'; brand: string; productName: string | null }
	| { status: 'not-found' };

/**
 * Resolves a scanned barcode to a company:
 * 1. community-maintained barcode -> company override (fastest, works offline)
 * 2. Open Food Facts brand lookup, matched against company name/aliases
 */
export async function lookupBarcode(dataset: Dataset, gtin: string): Promise<LookupResult> {
	const overrideMatch = findCompanyByBarcode(dataset, gtin);
	if (overrideMatch) return { status: 'found', company: overrideMatch, via: 'barcode-override' };

	const product = await lookupOpenFoodFacts(gtin);
	if (!product?.brand) return { status: 'not-found' };

	const brandMatch = findCompanyByBrandName(dataset, product.brand);
	if (brandMatch) return { status: 'found', company: brandMatch, via: 'brand-match' };

	return { status: 'unknown-brand', brand: product.brand, productName: product.productName };
}
