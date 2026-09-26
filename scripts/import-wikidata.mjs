#!/usr/bin/env node
// Proposes `wikidataId` and `parentId` for data/companies/** from Wikidata.
// Maintainer tool, never part of the build: run it, read the diff, open a PR.
//
//   node scripts/import-wikidata.mjs             # dry run, prints what would change
//   node scripts/import-wikidata.mjs --write     # apply to data/companies/**
//   node scripts/import-wikidata.mjs --write --only nestle,migros

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const companiesDir = path.join(rootDir, 'data', 'companies');

const API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT =
	'open-conscious-spender-import/1.0 (https://github.com/fdendorfer/open-conscious-spender)';

// P31 values that mark an entity as a company rather than a person, brand or product.
const ORGANISATION_TYPES = new Set([
	'Q4830453', // business
	'Q6881511', // enterprise
	'Q43229', // organization
	'Q891723', // public company
	'Q740752', // Aktiengesellschaft
	'Q1589009', // privately held company
	'Q18388277', // technology company
	'Q219577', // holding company
	'Q3742167', // cooperative
	'Q1414296', // consumer cooperative
	'Q614084', // cooperative federation
	'Q157031' // foundation
]);

// Claims only a legal entity carries — the type list alone misses the long tail
// of P31 values (Migros is a "cooperative federation", not a "business").
const ORGANISATION_CLAIMS = ['P452', 'P1454', 'P2139', 'P1128']; // industry, legal form, revenue, employees

// P749 only: P127 ("owned by") is populated with institutional shareholders,
// and importing BlackRock as Nestlé's parent would be worse than no data.
const PARENT_PROPERTIES = ['P749']; // parent organization

const args = process.argv.slice(2);
const write = args.includes('--write');
const onlyArg = args[args.indexOf('--only') + 1];
const only = args.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;

async function api(params) {
	const url = `${API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`;
	const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
	if (!res.ok) throw new Error(`Wikidata ${res.status} for ${params.action}`);
	return res.json();
}

/** Wikidata rate-limits anonymous callers; one request at a time with a short gap stays well inside it. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchEntity(name) {
	const data = await api({ action: 'wbsearchentities', search: name, language: 'en', limit: '5' });
	return (data.search ?? []).map((hit) => hit.id);
}

async function getEntities(ids) {
	if (!ids.length) return {};
	const data = await api({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels' });
	return data.entities ?? {};
}

function claimValues(entity, property) {
	return (entity.claims?.[property] ?? [])
		.filter((c) => c.mainsnak?.snaktype === 'value')
		.map((c) => c.mainsnak.datavalue?.value)
		.filter(Boolean);
}

function claimIds(entity, property) {
	return (entity.claims?.[property] ?? [])
		.filter((c) => c.mainsnak?.snaktype === 'value')
		.map((c) => c.mainsnak.datavalue?.value?.id)
		.filter(Boolean);
}

function isOrganisation(entity) {
	if (claimIds(entity, 'P31').some((id) => ORGANISATION_TYPES.has(id))) return true;
	return ORGANISATION_CLAIMS.some((p) => (entity.claims?.[p] ?? []).length > 0);
}

const countryCodeCache = new Map();

/** ISO 3166-1 alpha-2 of an entity's P17, to match against a company's `country`. */
async function countryCodeOf(entity) {
	const [countryQid] = claimIds(entity, 'P17');
	if (!countryQid) return null;
	if (!countryCodeCache.has(countryQid)) {
		const entities = await getEntities([countryQid]);
		const [code] = claimValues(entities[countryQid] ?? {}, 'P297');
		countryCodeCache.set(countryQid, typeof code === 'string' ? code : null);
	}
	return countryCodeCache.get(countryQid);
}

/**
 * The best search hit Wikidata classifies as an organisation, preferring one
 * headquartered in the company's country — "Sanitas" and "Raiffeisen" both name
 * a bigger foreign company than the Swiss one the dataset means.
 */
async function resolveCompanyEntity(company) {
	let fallback = null;
	for (const name of [company.name, ...company.aliases]) {
		const ids = await searchEntity(name);
		const entities = await getEntities(ids);
		const organisations = ids.map((id) => entities[id]).filter((e) => e && isOrganisation(e));

		for (const entity of organisations) {
			if (!company.country) return { entity, countryMatch: true };
			if ((await countryCodeOf(entity)) === company.country) return { entity, countryMatch: true };
			fallback ??= entity;
		}
		await sleep(150);
	}
	return fallback ? { entity: fallback, countryMatch: false } : null;
}

/**
 * A candidate parent only counts once Wikidata classifies it as an organisation
 * too — P749 occasionally points at a brand or a defunct holding shell.
 */
async function firstOrganisationParent(entity) {
	const candidates = PARENT_PROPERTIES.flatMap((p) => claimIds(entity, p)).filter(
		(qid) => qid !== entity.id
	);
	if (!candidates.length) return null;
	const entities = await getEntities([...new Set(candidates)]);
	return candidates.find((qid) => entities[qid] && isOrganisation(entities[qid])) ?? null;
}

async function main() {
	const files = (await readdir(companiesDir)).filter((f) => f.endsWith('.json'));
	const companies = [];
	for (const file of files) {
		const company = JSON.parse(await readFile(path.join(companiesDir, file), 'utf-8'));
		companies.push({ file, company });
	}

	const byQid = new Map();
	for (const { company } of companies) {
		if (company.wikidataId) byQid.set(company.wikidataId, company.id);
	}

	const targets = companies.filter(({ company }) => !only || only.has(company.id));
	const changes = [];
	const unmatched = [];
	const uncertain = [];
	const externalParents = [];

	// First pass resolves QIDs, so the second pass can map a parent QID onto a company we already have.
	for (const target of targets) {
		const { company } = target;
		if (company.wikidataId) continue;
		const match = await resolveCompanyEntity(company);
		if (!match) {
			unmatched.push(company.id);
			continue;
		}
		target.entity = match.entity;
		if (!match.countryMatch) uncertain.push({ id: company.id, qid: match.entity.id });
		byQid.set(match.entity.id, company.id);
		await sleep(150);
	}

	for (const target of targets) {
		const { company, entity } = target;
		const patch = {};

		if (entity && company.wikidataId !== entity.id) patch.wikidataId = entity.id;

		const source = entity ?? (company.wikidataId ? (await getEntities([company.wikidataId]))[company.wikidataId] : null);
		if (source && !company.parentId) {
			const parentQid = await firstOrganisationParent(source);
			if (parentQid) {
				const parentId = byQid.get(parentQid);
				if (parentId && parentId !== company.id) patch.parentId = parentId;
				else if (!parentId) externalParents.push({ id: company.id, parentQid });
			}
		}

		if (Object.keys(patch).length) changes.push({ ...target, patch });
	}

	for (const { file, company, patch } of changes) {
		console.log(`${company.id}: ${JSON.stringify(patch)}`);
		if (!write) continue;
		// Rewrite in place so unrelated keys and their order survive the round trip.
		const updated = { ...company, ...patch };
		await writeFile(path.join(companiesDir, file), `${JSON.stringify(updated, null, 2)}\n`);
	}

	if (externalParents.length) {
		console.log('\nParents not in the dataset (add the company first, then rerun):');
		for (const { id, parentQid } of externalParents) {
			console.log(`  ${id} -> https://www.wikidata.org/wiki/${parentQid}`);
		}
	}
	if (uncertain.length) {
		console.log('\nMatched, but not in the expected country — check these by hand:');
		for (const { id, qid } of uncertain) {
			console.log(`  ${id} -> https://www.wikidata.org/wiki/${qid}`);
		}
	}
	if (unmatched.length) console.log(`\nNo Wikidata match: ${unmatched.join(', ')}`);

	console.log(
		`\n${changes.length} of ${targets.length} companies ${write ? 'updated' : 'would change'}.`
	);
	if (!write && changes.length) console.log('Rerun with --write to apply.');
}

await main();
