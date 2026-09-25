import {
	commentOnIssue,
	createBranch,
	createIssue,
	fetchPublicJson,
	getFile,
	listOpenIssues,
	openPullRequest,
	publicFileExists,
	putFile,
	updateIssue
} from './github';
import type { Category, Env, FlagInput } from './types';
import { SEVERITIES } from './types';
import {
	BRAND_REQUEST_LABEL,
	DATA_CORRECTION_LABEL,
	brandRequestBody,
	brandRequestTitle,
	dataCorrectionBody,
	dataCorrectionTitle,
	issueKey,
	readCount,
	reportComment
} from './issueBody';
import {
	assertCompanyId,
	assertOneOf,
	assertOptionalString,
	assertString,
	jsonResponse,
	slugify,
	ValidationError
} from './util';

const MAX_FLAGS_PER_SUBMISSION = 5;

function corsHeaders(env: Env): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'content-type'
	};
}

function githubConfig(env: Env) {
	return {
		owner: env.GITHUB_OWNER,
		repo: env.GITHUB_REPO,
		defaultBranch: env.GITHUB_DEFAULT_BRANCH,
		token: env.GITHUB_PAT
	};
}

async function validCategoryIds(env: Env): Promise<string[]> {
	const categories = (await fetchPublicJson(githubConfig(env), 'data/categories.json')) as Category[];
	return categories.map((c) => c.id);
}

function parseFlag(raw: unknown, validCategories: string[]): FlagInput {
	if (typeof raw !== 'object' || raw === null) throw new ValidationError('flag must be an object');
	const f = raw as Record<string, unknown>;
	const category = assertOneOf(f.category, 'flag.category', validCategories);
	return {
		category,
		description: assertString(f.description, 'flag.description', 2000),
		severity: assertOneOf(f.severity, 'flag.severity', SEVERITIES),
		sourceUrl: assertOptionalString(f.sourceUrl, 'flag.sourceUrl', 500)
	};
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function toStoredFlag(flag: FlagInput) {
	return {
		category: flag.category,
		description: flag.description,
		sourceUrl: flag.sourceUrl,
		dateAdded: todayIso(),
		severity: flag.severity,
		// always "unverified" on submission, even with a sourceUrl — a contributor-supplied
		// link isn't itself proof; a maintainer promotes to "sourced" after checking it during PR review
		status: 'unverified'
	};
}

async function handleNewCompany(env: Env, body: Record<string, unknown>): Promise<Response> {
	const name = assertString(body.name, 'name', 200);
	const country = assertOptionalString(body.country, 'country', 2);
	const slug = slugify(name);
	if (!slug) throw new ValidationError('name did not produce a usable slug');

	const validCategories = await validCategoryIds(env);
	const rawFlags = Array.isArray(body.flags) ? body.flags : [];
	if (rawFlags.length === 0) throw new ValidationError('at least one flag is required');
	if (rawFlags.length > MAX_FLAGS_PER_SUBMISSION) {
		throw new ValidationError(`at most ${MAX_FLAGS_PER_SUBMISSION} flags per submission`);
	}
	const flags = rawFlags.map((f) => toStoredFlag(parseFlag(f, validCategories)));

	const config = githubConfig(env);
	const path = `data/companies/${slug}.json`;
	if (await getFile(config, path)) {
		throw new ValidationError(`a company with slug "${slug}" already exists — submit a new-flag instead`);
	}

	const company = {
		id: slug,
		name,
		aliases: [],
		brands: [],
		country,
		parentId: null,
		wikidataId: null,
		flags
	};

	const branch = `contribution/new-company-${slug}-${Date.now()}`;
	await createBranch(config, branch);
	await putFile(config, branch, path, company, `Add company: ${name}`, null);
	const prUrl = await openPullRequest(
		config,
		branch,
		`Add company: ${name}`,
		`Submitted via the app's "add company" flow. Please review flag sourcing before merging.`
	);
	return jsonResponse({ prUrl });
}

async function handleNewFlag(env: Env, body: Record<string, unknown>): Promise<Response> {
	const companyId = assertCompanyId(body.companyId, 'companyId');
	const validCategories = await validCategoryIds(env);
	const flag = toStoredFlag(parseFlag(body.flag, validCategories));

	const config = githubConfig(env);
	const path = `data/companies/${companyId}.json`;
	const existing = await getFile(config, path);
	if (!existing) throw new ValidationError(`no company found with id "${companyId}"`);

	const company = existing.json as { flags: unknown[]; name: string };
	company.flags = [...(company.flags ?? []), flag];

	const branch = `contribution/new-flag-${companyId}-${Date.now()}`;
	await createBranch(config, branch);
	await putFile(config, branch, path, company, `Add flag to ${company.name}`, existing.sha);
	const prUrl = await openPullRequest(
		config,
		branch,
		`Add flag to ${company.name}`,
		`Submitted via the app's "add flag" flow. Please review flag sourcing before merging.`
	);
	return jsonResponse({ prUrl });
}

async function handleNewBarcodeMapping(env: Env, body: Record<string, unknown>): Promise<Response> {
	const gtin = assertString(body.gtin, 'gtin', 14);
	if (!/^\d{8,14}$/.test(gtin)) throw new ValidationError('gtin must be 8-14 digits');
	const companyId = assertCompanyId(body.companyId, 'companyId');

	const config = githubConfig(env);
	const path = 'data/products/barcode-overrides.json';
	const existing = await getFile(config, path);
	const mapping = (existing?.json as Record<string, string>) ?? {};
	if (mapping[gtin]) throw new ValidationError(`barcode ${gtin} is already mapped`);
	mapping[gtin] = companyId;

	const branch = `contribution/barcode-${gtin}-${Date.now()}`;
	await createBranch(config, branch);
	await putFile(config, branch, path, mapping, `Map barcode ${gtin} to ${companyId}`, existing?.sha ?? null);
	const prUrl = await openPullRequest(
		config,
		branch,
		`Map barcode ${gtin} to ${companyId}`,
		`Submitted via the app's barcode-lookup-miss flow.`
	);
	return jsonResponse({ prUrl });
}

async function handleBrandRequest(env: Env, body: Record<string, unknown>): Promise<Response> {
	const name = assertString(body.name, 'name', 200);
	const gtin = assertOptionalString(body.gtin, 'gtin', 14);
	const note = assertOptionalString(body.note, 'note', 2000);
	const slug = slugify(name);
	if (!slug) throw new ValidationError('name did not produce a usable slug');

	const config = githubConfig(env);
	if (await publicFileExists(config, `data/companies/${slug}.json`)) {
		throw new ValidationError(`"${name}" is already in the dataset`);
	}

	const open = await listOpenIssues(config, BRAND_REQUEST_LABEL);
	const existing = open.find(
		(i) => issueKey(i, BRAND_REQUEST_LABEL, 'Brand request: ', slugify) === slug
	);

	if (!existing) {
		const issue = await createIssue(config, brandRequestTitle(name, 1), brandRequestBody(name, slug, 1), [
			BRAND_REQUEST_LABEL
		]);
		if (gtin || note) await commentOnIssue(config, issue.number, requestDetail(gtin, note));
		return jsonResponse({ issueUrl: issue.html_url, requestCount: 1 });
	}

	// Read-modify-write on the count: GitHub exposes no conditional write for an issue body, so two
	// requests in the same instant can drop one increment. Acceptable for a soft priority number.
	const count = readCount(existing.body) + 1;
	await updateIssue(config, existing.number, {
		title: brandRequestTitle(name, count),
		body: brandRequestBody(name, slug, count)
	});
	if (gtin || note) await commentOnIssue(config, existing.number, requestDetail(gtin, note));
	return jsonResponse({ issueUrl: existing.html_url, requestCount: count });
}

function requestDetail(gtin: string | null, note: string | null): string {
	const lines: string[] = [];
	if (gtin) lines.push(`Scanned barcode: \`${gtin}\``);
	if (note) lines.push(note.replace(/^/gm, '> '));
	return lines.join('\n\n');
}

async function handleInaccuracyReport(env: Env, body: Record<string, unknown>): Promise<Response> {
	const companyId = assertCompanyId(body.companyId, 'companyId');
	const note = assertString(body.note, 'note', 2000);

	const config = githubConfig(env);
	const company = (await fetchPublicJson(config, `data/companies/${companyId}.json`).catch(() => {
		throw new ValidationError(`no company found with id "${companyId}"`);
	})) as { name: string };

	const open = await listOpenIssues(config, DATA_CORRECTION_LABEL);
	const existing = open.find(
		(i) => issueKey(i, DATA_CORRECTION_LABEL, 'Data correction: ', slugify) === companyId
	);

	const issue =
		existing ??
		(await createIssue(
			config,
			dataCorrectionTitle(company.name),
			dataCorrectionBody(companyId, company.name),
			[DATA_CORRECTION_LABEL]
		));
	await commentOnIssue(config, issue.number, reportComment(note, todayIso()));
	return jsonResponse({ issueUrl: issue.html_url });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders(env) });
		}

		const url = new URL(request.url);
		if (request.method !== 'POST') {
			return jsonResponse({ error: 'not found' }, { status: 404, headers: corsHeaders(env) });
		}

		try {
			const body = (await request.json()) as Record<string, unknown>;
			let response: Response;
			switch (url.pathname) {
				case '/submit/company':
					response = await handleNewCompany(env, body);
					break;
				case '/submit/flag':
					response = await handleNewFlag(env, body);
					break;
				case '/submit/barcode':
					response = await handleNewBarcodeMapping(env, body);
					break;
				case '/request/brand':
					response = await handleBrandRequest(env, body);
					break;
				case '/report/inaccuracy':
					response = await handleInaccuracyReport(env, body);
					break;
				default:
					return jsonResponse({ error: 'not found' }, { status: 404, headers: corsHeaders(env) });
			}
			for (const [k, v] of Object.entries(corsHeaders(env))) response.headers.set(k, v);
			return response;
		} catch (err) {
			const status = err instanceof ValidationError ? 400 : 502;
			return jsonResponse(
				{ error: err instanceof Error ? err.message : 'unknown error' },
				{ status, headers: corsHeaders(env) }
			);
		}
	}
};
