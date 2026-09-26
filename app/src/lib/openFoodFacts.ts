export interface OffProduct {
	brand: string | null;
	productName: string | null;
	/** Which Open Facts database answered — surfaced so a miss can say where it looked. */
	source: string;
}

interface FactsSource {
	name: string;
	host: string;
}

// Same API shape across all four. Food first: it is by far the largest and the
// most likely hit for a supermarket scan.
const SOURCES: FactsSource[] = [
	{ name: 'Open Food Facts', host: 'world.openfoodfacts.org' },
	{ name: 'Open Beauty Facts', host: 'world.openbeautyfacts.org' },
	{ name: 'Open Pet Food Facts', host: 'world.openpetfoodfacts.org' },
	{ name: 'Open Products Facts', host: 'world.openproductsfacts.org' }
];

async function lookupOne(source: FactsSource, gtin: string): Promise<OffProduct | null> {
	try {
		const res = await fetch(
			`https://${source.host}/api/v2/product/${encodeURIComponent(gtin)}.json?fields=product_name,brands`
		);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			status: number;
			product?: { product_name?: string; brands?: string };
		};
		if (data.status !== 1 || !data.product) return null;
		// the "brands" field is a comma-separated list, most specific first
		const brand = data.product.brands?.split(',')[0]?.trim() || null;
		if (!brand) return null;
		return { brand, productName: data.product.product_name ?? null, source: source.name };
	} catch {
		return null;
	}
}

/**
 * Resolves a barcode against the Open Facts databases. All four are queried at
 * once but awaited in {@link SOURCES} order, so a miss costs one round trip
 * rather than four while someone stands in an aisle, and the answer stays
 * deterministic when two databases both know the barcode.
 */
export async function lookupOpenFoodFacts(gtin: string): Promise<OffProduct | null> {
	const pending = SOURCES.map((source) => lookupOne(source, gtin));
	for (const request of pending) {
		const hit = await request;
		if (hit) return hit;
	}
	return null;
}
