import { get, set } from 'idb-keyval';

export interface Category {
	id: string;
	name: string;
	description: string;
	icon: string;
	defaultWeight: number;
}

const RAW_BASE =
	'https://raw.githubusercontent.com/fdendorfer/open-conscious-spender/master/data/dist';
const CACHE_KEY = 'ocs-dataset-v1';

export interface StoredFlag {
	category: string;
	description: string;
	sourceUrl: string | null;
	dateAdded: string;
	severity: 'minor' | 'moderate' | 'severe' | 'systemic';
	status: 'sourced' | 'unverified';
	polarity?: 'positive' | 'negative'; // defaults to 'negative'
}

export interface Company {
	id: string;
	name: string;
	aliases: string[];
	brands: string[];
	country: string | null;
	parentId: string | null;
	wikidataId: string | null;
	flags: StoredFlag[];
}

export interface Dataset {
	version: string;
	categories: Category[];
	companies: Company[];
	barcodeOverrides: Record<string, string>;
}

interface Meta {
	version: string;
	builtAt: string;
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return res.json();
}

/**
 * Backfills fields added to the schema after older bundles/caches were written
 * (e.g. IndexedDB may still hold a dataset fetched before `brands` existed).
 */
function normalizeDataset(raw: Dataset): Dataset {
	return {
		...raw,
		companies: raw.companies.map((c) => ({ ...c, brands: c.brands ?? [] }))
	};
}

/**
 * Returns the freshest dataset available: cached copy immediately if present,
 * refreshed in the background when online and stale. Never blocks on network
 * when a cached copy exists — this needs to work standing in a store aisle.
 */
export async function loadDataset(): Promise<Dataset> {
	const cached = await get<Dataset>(CACHE_KEY);

	// fire-and-forget refresh; callers that want to react to updates can call
	// loadDataset() again later (e.g. on next app foreground)
	void refreshIfStale(cached);

	if (cached) return normalizeDataset(cached);

	// no cache yet (first run) — this one has to block on the network
	const bundle = await fetchJson<Omit<Dataset, 'version'>>(`${RAW_BASE}/bundle.json`);
	const meta = await fetchJson<Meta>(`${RAW_BASE}/meta.json`);
	const dataset = normalizeDataset({ ...bundle, version: meta.version });
	await set(CACHE_KEY, dataset);
	return dataset;
}

async function refreshIfStale(cached: Dataset | undefined): Promise<void> {
	try {
		const meta = await fetchJson<Meta>(`${RAW_BASE}/meta.json`);
		if (cached && cached.version === meta.version) return;
		const bundle = await fetchJson<Omit<Dataset, 'version'>>(`${RAW_BASE}/bundle.json`);
		await set(CACHE_KEY, normalizeDataset({ ...bundle, version: meta.version }));
	} catch {
		// offline or GitHub unreachable — keep serving the cached copy
	}
}

export function findCompanyById(dataset: Dataset, id: string): Company | undefined {
	return dataset.companies.find((c) => c.id === id);
}

export function findCompanyByBarcode(dataset: Dataset, gtin: string): Company | undefined {
	const companyId = dataset.barcodeOverrides[gtin];
	return companyId ? findCompanyById(dataset, companyId) : undefined;
}

/** Ownership chain from a company up to its ultimate parent, company itself first. */
export function ownershipChain(dataset: Dataset, company: Company): Company[] {
	const chain = [company];
	let current = company;
	while (current.parentId) {
		const parent = findCompanyById(dataset, current.parentId);
		if (!parent || chain.includes(parent)) break; // guard against cycles/missing data
		chain.push(parent);
		current = parent;
	}
	return chain;
}

/** Case-insensitive match of a brand name against a company's name/aliases/brands. */
export function findCompanyByBrandName(dataset: Dataset, brandName: string): Company | undefined {
	const needle = brandName.trim().toLowerCase();
	if (!needle) return undefined;
	return dataset.companies.find(
		(c) =>
			c.name.toLowerCase() === needle ||
			c.aliases.some((a) => a.toLowerCase() === needle) ||
			c.brands.some((b) => b.toLowerCase() === needle)
	);
}

export interface CompanySearchResult {
	company: Company;
	/** Set when the query only matched a brand name, so the UI can show "Brand (Company)". */
	matchedBrand: string | null;
}

/** Live-search companies by name/alias/brand substring match — this is the app's primary lookup path. */
export function searchCompaniesByName(
	dataset: Dataset,
	query: string,
	limit = 8
): CompanySearchResult[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	const results: CompanySearchResult[] = [];
	for (const c of dataset.companies) {
		const nameMatch =
			c.name.toLowerCase().includes(needle) || c.aliases.some((a) => a.toLowerCase().includes(needle));
		const matchedBrand = nameMatch
			? null
			: (c.brands.find((b) => b.toLowerCase().includes(needle)) ?? null);
		if (nameMatch || matchedBrand) results.push({ company: c, matchedBrand });
		if (results.length >= limit) break;
	}
	return results;
}
