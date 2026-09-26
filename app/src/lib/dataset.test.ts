import { describe, expect, it } from 'vitest';
import {
	findCompanyByBarcode,
	findCompanyByBrandName,
	findCompanyById,
	ownershipChain,
	searchCompaniesByName,
	type Company,
	type Dataset
} from './dataset';

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
	companies: [
		company('loreal', { name: "L'Oréal", brands: ['Maybelline', 'La Roche-Posay'] }),
		company('eth-zuerich', { name: 'ETH Zürich' }),
		company('coca-cola', { name: 'The Coca-Cola Company', brands: ['Fanta'] }),
		company('coop', { name: 'Coop' }),
		company('concordia', { name: 'Concordia' }),
		company('nestle', { name: 'Nestlé', aliases: ['Nestle'], brands: ['KitKat'] }),
		company('feldschloesschen', { name: 'Feldschlösschen', parentId: 'carlsberg' }),
		company('carlsberg', { name: 'Carlsberg Group' })
	],
	barcodeOverrides: { '7610807000123': 'nestle' }
};

const names = (q: string, limit?: number) =>
	searchCompaniesByName(dataset, q, limit).map((r) => r.company.name);

describe('searchCompaniesByName', () => {
	it('matches across dropped diacritics', () => {
		expect(names('loreal')).toContain("L'Oréal");
		expect(names('zurich')).toContain('ETH Zürich');
		expect(names('feldschlosschen')).toContain('Feldschlösschen');
		expect(names('nestle')).toContain('Nestlé');
	});

	it('matches when the query keeps the diacritics', () => {
		expect(names('zürich')).toContain('ETH Zürich');
		expect(names('nestlé')).toContain('Nestlé');
	});

	it('ignores punctuation and separators on both sides', () => {
		expect(names("l'oreal")).toContain("L'Oréal");
		expect(names('coca cola')).toContain('The Coca-Cola Company');
		expect(names('cocacola')).toContain('The Coca-Cola Company');
		expect(names('coca-cola')).toContain('The Coca-Cola Company');
	});

	it('ranks an exact match first', () => {
		expect(names('coop')[0]).toBe('Coop');
	});

	it('ranks prefix matches above mid-string ones', () => {
		const result = names('co');
		expect(result.indexOf('Coop')).toBeLessThan(result.indexOf('The Coca-Cola Company'));
	});

	it('ranks a name match above a brand-only match', () => {
		const result = searchCompaniesByName(dataset, 'coca');
		expect(result[0].company.name).toBe('The Coca-Cola Company');
		expect(result[0].matchedBrand).toBeNull();
	});

	it('reports which brand matched when the company name did not', () => {
		const [hit] = searchCompaniesByName(dataset, 'kitkat');
		expect(hit.company.id).toBe('nestle');
		expect(hit.matchedBrand).toBe('KitKat');
	});

	it('respects the limit', () => {
		expect(names('c', 2)).toHaveLength(2);
	});

	it('returns nothing for empty or punctuation-only queries', () => {
		expect(searchCompaniesByName(dataset, '')).toEqual([]);
		expect(searchCompaniesByName(dataset, '   ')).toEqual([]);
		expect(searchCompaniesByName(dataset, '---')).toEqual([]);
	});

	it('returns nothing rather than throwing on no match', () => {
		expect(searchCompaniesByName(dataset, 'xyzzy')).toEqual([]);
	});
});

describe('findCompanyByBrandName', () => {
	it('matches a brand ignoring case, accents and punctuation', () => {
		expect(findCompanyByBrandName(dataset, 'la roche posay')?.id).toBe('loreal');
		expect(findCompanyByBrandName(dataset, "L'OREAL")?.id).toBe('loreal');
	});

	it('matches an alias', () => {
		expect(findCompanyByBrandName(dataset, 'Nestle')?.id).toBe('nestle');
	});

	it('requires a whole-value match, not a substring', () => {
		expect(findCompanyByBrandName(dataset, 'Kit')).toBeUndefined();
	});

	it('returns undefined for an empty query', () => {
		expect(findCompanyByBrandName(dataset, '  ')).toBeUndefined();
	});
});

describe('ownershipChain', () => {
	it('walks from a company up to its ultimate parent', () => {
		const chain = ownershipChain(dataset, findCompanyById(dataset, 'feldschloesschen')!);
		expect(chain.map((c) => c.id)).toEqual(['feldschloesschen', 'carlsberg']);
	});

	it('returns just the company when it has no parent', () => {
		const chain = ownershipChain(dataset, findCompanyById(dataset, 'coop')!);
		expect(chain.map((c) => c.id)).toEqual(['coop']);
	});

	it('stops instead of looping on a cycle', () => {
		const cyclic: Dataset = {
			...dataset,
			companies: [company('a', { parentId: 'b' }), company('b', { parentId: 'a' })]
		};
		const chain = ownershipChain(cyclic, cyclic.companies[0]);
		expect(chain.map((c) => c.id)).toEqual(['a', 'b']);
	});

	it('stops when a parentId dangles', () => {
		const broken: Dataset = { ...dataset, companies: [company('a', { parentId: 'ghost' })] };
		expect(ownershipChain(broken, broken.companies[0]).map((c) => c.id)).toEqual(['a']);
	});
});

describe('findCompanyByBarcode', () => {
	it('resolves a mapped GTIN', () => {
		expect(findCompanyByBarcode(dataset, '7610807000123')?.id).toBe('nestle');
	});

	it('returns undefined for an unmapped GTIN', () => {
		expect(findCompanyByBarcode(dataset, '0000000000000')).toBeUndefined();
	});
});
