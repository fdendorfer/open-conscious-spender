export interface OffProduct {
	brand: string | null;
	productName: string | null;
}

/** Looks up a barcode via the Open Food Facts public API. Returns null on any failure or unknown code. */
export async function lookupOpenFoodFacts(gtin: string): Promise<OffProduct | null> {
	try {
		const res = await fetch(
			`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(gtin)}.json?fields=product_name,brands`
		);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			status: number;
			product?: { product_name?: string; brands?: string };
		};
		if (data.status !== 1 || !data.product) return null;
		// Open Food Facts' "brands" field is a comma-separated list, most specific first
		const brand = data.product.brands?.split(',')[0]?.trim() ?? null;
		return { brand, productName: data.product.product_name ?? null };
	} catch {
		return null;
	}
}
