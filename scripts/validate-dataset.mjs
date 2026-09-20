#!/usr/bin/env node
// Validates data/** against the schema the app expects (app/src/lib/dataset.ts).
// Errors fail the build; warnings are advisory. Run before build-dataset.mjs.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(rootDir, 'data');

const SEVERITIES = ['minor', 'moderate', 'severe', 'systemic'];
const STATUSES = ['sourced', 'unverified'];
const POLARITIES = ['positive', 'negative'];
const COMPANY_KEYS = [
	'id',
	'name',
	'aliases',
	'brands',
	'country',
	'parentId',
	'wikidataId',
	'flags'
];
const FLAG_KEYS = [
	'category',
	'description',
	'sourceUrl',
	'dateAdded',
	'severity',
	'status',
	'polarity'
];
const CATEGORY_KEYS = ['id', 'name', 'description', 'icon', 'defaultWeight'];
const GTIN_LENGTHS = [8, 12, 13, 14];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function isIsoDate(value) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isHttpUrl(value) {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

/** Standard GTIN mod-10 check digit, right-aligned so one rule covers GTIN-8/12/13/14. */
function hasValidCheckDigit(gtin) {
	const digits = [...gtin].map(Number);
	const check = digits.pop();
	let sum = 0;
	for (const [i, digit] of digits.reverse().entries()) sum += digit * (i % 2 === 0 ? 3 : 1);
	return (10 - (sum % 10)) % 10 === check;
}

/**
 * Keys of CATEGORY_ICONS in the app — a category icon outside this allowlist renders
 * as nothing. Returns null if the map can't be parsed, so the check is skipped rather
 * than firing false errors.
 */
async function readKnownIcons() {
	const iconsFile = path.join(rootDir, 'app', 'src', 'lib', 'categoryIcons.ts');
	if (!existsSync(iconsFile)) return null;
	const source = await readFile(iconsFile, 'utf-8');
	const body = source.match(/CATEGORY_ICONS[^=]*=\s*\{([^}]*)\}/s)?.[1];
	if (!body) return null;
	const icons = new Set(body.match(/[A-Z][A-Za-z0-9]*/g) ?? []);
	return icons.size ? icons : null;
}

async function readJson(filePath) {
	try {
		return JSON.parse(await readFile(filePath, 'utf-8'));
	} catch (e) {
		err(path.relative(rootDir, filePath), `unreadable or invalid JSON — ${e.message}`);
		return null;
	}
}

function checkUnknownKeys(where, obj, allowed) {
	for (const key of Object.keys(obj)) {
		if (!allowed.includes(key)) warn(where, `unknown field "${key}" — typo? it is dropped by the app`);
	}
}

function validateCategories(categories, knownIcons) {
	const ids = new Set();
	if (!Array.isArray(categories)) {
		err('categories.json', 'must be an array');
		return ids;
	}
	categories.forEach((category, i) => {
		const where = `categories.json[${i}]`;
		if (!isPlainObject(category)) return err(where, 'must be an object');
		checkUnknownKeys(where, category, CATEGORY_KEYS);

		if (!isNonEmptyString(category.id)) err(where, 'missing "id"');
		else if (ids.has(category.id)) err(where, `duplicate category id "${category.id}"`);
		else ids.add(category.id);

		for (const field of ['name', 'description', 'icon']) {
			if (!isNonEmptyString(category[field])) err(where, `missing "${field}"`);
		}
		if (typeof category.defaultWeight !== 'number' || category.defaultWeight <= 0) {
			err(where, '"defaultWeight" must be a positive number');
		}
		if (knownIcons && isNonEmptyString(category.icon) && !knownIcons.has(category.icon)) {
			err(where, `icon "${category.icon}" is not in CATEGORY_ICONS — it would render as nothing`);
		}
	});
	return ids;
}

function validateFlags(where, company, categoryIds) {
	if (!Array.isArray(company.flags)) return err(where, '"flags" must be an array');

	company.flags.forEach((flag, i) => {
		const flagWhere = `${where} flags[${i}]`;
		if (!isPlainObject(flag)) return err(flagWhere, 'must be an object');
		checkUnknownKeys(flagWhere, flag, FLAG_KEYS);

		if (!categoryIds.has(flag.category)) {
			err(flagWhere, `unknown category "${flag.category}" — not in categories.json`);
		}
		if (!isNonEmptyString(flag.description)) err(flagWhere, 'missing "description"');
		if (!SEVERITIES.includes(flag.severity)) {
			err(flagWhere, `"severity" must be one of ${SEVERITIES.join(', ')}`);
		}
		if (!STATUSES.includes(flag.status)) {
			err(flagWhere, `"status" must be one of ${STATUSES.join(', ')}`);
		}
		if ('polarity' in flag && !POLARITIES.includes(flag.polarity)) {
			err(flagWhere, `"polarity" must be one of ${POLARITIES.join(', ')} when present`);
		}

		if (!isIsoDate(flag.dateAdded ?? '')) err(flagWhere, '"dateAdded" must be a YYYY-MM-DD date');
		else if (flag.dateAdded > new Date().toISOString().slice(0, 10)) {
			warn(flagWhere, `"dateAdded" ${flag.dateAdded} is in the future`);
		}

		if (flag.sourceUrl !== null && !isHttpUrl(flag.sourceUrl ?? '')) {
			err(flagWhere, '"sourceUrl" must be an http(s) URL or null');
		}
		if (flag.status === 'sourced' && !flag.sourceUrl) {
			err(flagWhere, 'status "sourced" requires a "sourceUrl"');
		}
	});
}

function validateCompany(file, company, categoryIds) {
	const where = `companies/${file}`;
	if (!isPlainObject(company)) {
		err(where, 'must be an object');
		return;
	}
	checkUnknownKeys(where, company, COMPANY_KEYS);

	if (!isNonEmptyString(company.id)) err(where, 'missing "id"');
	else {
		if (company.id !== path.basename(file, '.json')) {
			err(where, `"id" is "${company.id}" but the filename says "${path.basename(file, '.json')}"`);
		}
		if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(company.id)) err(where, `"id" must be kebab-case`);
	}
	if (!isNonEmptyString(company.name)) err(where, 'missing "name"');

	for (const field of ['aliases', 'brands']) {
		const values = company[field];
		if (!Array.isArray(values) || !values.every(isNonEmptyString)) {
			err(where, `"${field}" must be an array of non-empty strings`);
			continue;
		}
		const seen = new Set(values.map((v) => v.toLowerCase()));
		if (seen.size !== values.length) err(where, `"${field}" contains duplicates`);
	}

	if (company.country !== null && !/^[A-Z]{2}$/.test(company.country ?? '')) {
		err(where, '"country" must be a 2-letter uppercase code or null');
	}
	if (company.wikidataId !== null && !/^Q\d+$/.test(company.wikidataId ?? '')) {
		err(where, '"wikidataId" must look like "Q12345" or be null');
	}
	if (!('parentId' in company)) err(where, 'missing "parentId" (use null for no parent)');

	validateFlags(where, company, categoryIds);
}

/** Cross-file checks that only make sense once every company is loaded. */
function validateRelations(companies) {
	const byId = new Map(companies.map((c) => [c.id, c]));

	for (const company of companies) {
		const where = `companies/${company.id}.json`;
		if (!company.parentId) continue;
		if (company.parentId === company.id) {
			err(where, '"parentId" points at itself');
			continue;
		}
		if (!byId.has(company.parentId)) {
			err(where, `"parentId" references unknown company "${company.parentId}"`);
			continue;
		}

		const seen = new Set([company.id]);
		let current = byId.get(company.parentId);
		while (current) {
			if (seen.has(current.id)) {
				err(where, `ownership cycle via "${current.id}"`);
				break;
			}
			seen.add(current.id);
			current = current.parentId ? byId.get(current.parentId) : undefined;
		}
	}

	// name/alias/brand collisions make findCompanyByBrandName ambiguous — it returns the first match
	const owners = new Map();
	for (const company of companies) {
		const labels = [company.name, ...(company.aliases ?? []), ...(company.brands ?? [])];
		for (const label of new Set(labels.filter(isNonEmptyString).map((l) => l.toLowerCase()))) {
			if (owners.has(label)) {
				warn(
					'companies',
					`"${label}" is claimed by both "${owners.get(label)}" and "${company.id}" — brand lookup picks one arbitrarily`
				);
			} else owners.set(label, company.id);
		}
	}
}

function validateBarcodeOverrides(overrides, companyIds) {
	const where = 'products/barcode-overrides.json';
	if (!isPlainObject(overrides)) return err(where, 'must be an object');

	for (const [gtin, companyId] of Object.entries(overrides)) {
		if (gtin === '_comment') continue;
		if (!/^\d+$/.test(gtin) || !GTIN_LENGTHS.includes(gtin.length)) {
			err(where, `"${gtin}" must be ${GTIN_LENGTHS.join('/')} digits`);
		} else if (!hasValidCheckDigit(gtin)) {
			warn(where, `"${gtin}" has an invalid GTIN check digit`);
		}
		if (!companyIds.has(companyId)) {
			err(where, `"${gtin}" maps to unknown company "${companyId}"`);
		}
	}
}

async function validate() {
	const knownIcons = await readKnownIcons();
	const categories = await readJson(path.join(dataDir, 'categories.json'));
	const categoryIds = categories ? validateCategories(categories, knownIcons) : new Set();

	const companiesDir = path.join(dataDir, 'companies');
	const companies = [];
	if (!existsSync(companiesDir)) {
		err('data', 'companies/ directory is missing');
	} else {
		const files = (await readdir(companiesDir)).filter((f) => f.endsWith('.json')).sort();
		const seenIds = new Set();
		for (const file of files) {
			const company = await readJson(path.join(companiesDir, file));
			if (!company) continue;
			validateCompany(file, company, categoryIds);
			if (seenIds.has(company.id)) err(`companies/${file}`, `duplicate company id "${company.id}"`);
			seenIds.add(company.id);
			companies.push(company);
		}
		validateRelations(companies);
	}

	const overrides = await readJson(path.join(dataDir, 'products', 'barcode-overrides.json'));
	if (overrides) validateBarcodeOverrides(overrides, new Set(companies.map((c) => c.id)));

	for (const message of warnings) console.warn(`warning  ${message}`);
	for (const message of errors) console.error(`error    ${message}`);

	const summary = `${companies.length} companies, ${categoryIds.size} categories`;
	if (errors.length) {
		console.error(`\nDataset invalid: ${errors.length} error(s), ${warnings.length} warning(s).`);
		process.exitCode = 1;
	} else {
		console.log(`\nDataset valid: ${summary}, ${warnings.length} warning(s).`);
	}
}

validate().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
