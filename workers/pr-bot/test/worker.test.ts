import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

const env: Env = {
	GITHUB_PAT: 'test-token',
	GITHUB_OWNER: 'owner',
	GITHUB_REPO: 'repo',
	GITHUB_DEFAULT_BRANCH: 'main',
	ALLOWED_ORIGIN: 'https://app.test'
};

const REPO = '/repos/owner/repo';
const RAW = 'https://raw.githubusercontent.com/owner/repo/main/';

interface FakeIssue {
	number: number;
	title: string;
	body: string | null;
	html_url: string;
	labels: string[];
	pull_request?: unknown;
}

interface Call {
	method: string;
	path: string;
	body: Record<string, unknown> | null;
}

/** In-memory stand-in for the slice of GitHub the Worker touches. */
class FakeGithub {
	files = new Map<string, unknown>();
	issues: FakeIssue[] = [];
	calls: Call[] = [];

	writes(): Call[] {
		return this.calls.filter((c) => c.method !== 'GET' && c.method !== 'HEAD');
	}

	async handle(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
		const url = new URL(typeof input === 'string' ? input : input.toString());
		const method = init.method ?? 'GET';
		const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;

		if (url.href.startsWith(RAW)) {
			const path = url.href.slice(RAW.length);
			this.calls.push({ method, path: `raw:${path}`, body: null });
			if (!this.files.has(path)) return new Response('404', { status: 404 });
			return Response.json(this.files.get(path));
		}

		const path = url.pathname;
		this.calls.push({ method, path, body });

		if (method === 'GET' && path.startsWith(`${REPO}/contents/`)) {
			const file = path.slice(`${REPO}/contents/`.length);
			if (!this.files.has(file)) return new Response('{}', { status: 404 });
			const content = Buffer.from(JSON.stringify(this.files.get(file))).toString('base64');
			return Response.json({ sha: `sha-${file}`, content });
		}
		if (method === 'GET' && path === `${REPO}/git/ref/heads/main`) {
			return Response.json({ object: { sha: 'main-sha' } });
		}
		if (method === 'POST' && path === `${REPO}/git/refs`) return Response.json({});
		if (method === 'PUT' && path.startsWith(`${REPO}/contents/`)) return Response.json({});
		if (method === 'POST' && path === `${REPO}/pulls`) {
			return Response.json({ html_url: 'https://github.com/owner/repo/pull/1' });
		}
		if (method === 'GET' && path === `${REPO}/issues`) {
			const label = url.searchParams.get('labels');
			return Response.json(this.issues.filter((i) => label && i.labels.includes(label)));
		}
		if (method === 'POST' && path === `${REPO}/issues`) {
			const number = this.issues.length + 100;
			const issue: FakeIssue = {
				number,
				title: body!.title as string,
				body: body!.body as string,
				labels: body!.labels as string[],
				html_url: `https://github.com/owner/repo/issues/${number}`
			};
			this.issues.push(issue);
			return Response.json(issue);
		}
		const issueMatch = path.match(new RegExp(`^${REPO}/issues/(\\d+)(/comments)?$`));
		if (issueMatch) {
			const issue = this.issues.find((i) => i.number === Number(issueMatch[1]));
			if (!issue) return new Response('{}', { status: 404 });
			if (method === 'PATCH') Object.assign(issue, body);
			return Response.json({});
		}
		return new Response(`unhandled ${method} ${path}`, { status: 500 });
	}
}

let github: FakeGithub;

beforeEach(() => {
	github = new FakeGithub();
	github.files.set('data/categories.json', [{ id: 'human-rights' }, { id: 'environment' }]);
	github.files.set('data/companies/nestle.json', { id: 'nestle', name: 'Nestlé', flags: [] });
	vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => github.handle(input, init));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function post(path: string, body: unknown): Promise<Response> {
	return worker.fetch(
		new Request(`https://bot.test${path}`, { method: 'POST', body: JSON.stringify(body) }),
		env
	);
}

const validFlag = { category: 'human-rights', description: 'Child labour report', severity: 'severe' };

describe('routing and CORS', () => {
	it('answers preflight with the allowed origin', async () => {
		const res = await worker.fetch(new Request('https://bot.test/submit/flag', { method: 'OPTIONS' }), env);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
	});

	it('404s on GET and on unknown paths', async () => {
		expect((await worker.fetch(new Request('https://bot.test/'), env)).status).toBe(404);
		expect((await post('/nope', {})).status).toBe(404);
	});

	it('maps GitHub failures to 502 with CORS headers', async () => {
		vi.stubGlobal('fetch', async () => new Response('boom', { status: 500 }));
		const res = await post('/request/brand', { name: 'Acme' });
		expect(res.status).toBe(502);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
	});
});

describe('/request/brand', () => {
	it('opens a labelled issue for a new brand', async () => {
		const res = await post('/request/brand', { name: 'Acme Foods' });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ requestCount: 1 });
		expect(github.issues).toHaveLength(1);
		expect(github.issues[0]).toMatchObject({ title: 'Brand request: Acme Foods', labels: ['brand-request'] });
		expect(github.issues[0].body).toContain('<!-- ocs:brand-request:acme-foods -->');
	});

	it('increments the existing issue instead of opening a duplicate', async () => {
		await post('/request/brand', { name: 'Acme Foods' });
		const res = await post('/request/brand', { name: 'ACME foods' });
		expect(await res.json()).toMatchObject({ requestCount: 2 });
		expect(github.issues).toHaveLength(1);
		expect(github.issues[0].title).toBe('Brand request: ACME foods (×2)');
		expect(github.issues[0].body).toContain('<!-- ocs:count:2 -->');
	});

	it('matches a hand-filed issue by its title', async () => {
		github.issues.push({
			number: 7,
			title: 'Brand request: Acme Foods (×3)',
			body: 'filed by hand',
			labels: ['brand-request'],
			html_url: 'https://github.com/owner/repo/issues/7'
		});
		const res = await post('/request/brand', { name: 'Acme Foods' });
		expect(await res.json()).toMatchObject({ issueUrl: 'https://github.com/owner/repo/issues/7' });
		expect(github.issues).toHaveLength(1);
	});

	it('comments the barcode and note when given', async () => {
		await post('/request/brand', { name: 'Acme', gtin: '7610000000000', note: 'at Migros' });
		const comment = github.calls.find((c) => c.path.endsWith('/comments'));
		expect(comment?.body?.body).toContain('`7610000000000`');
		expect(comment?.body?.body).toContain('> at Migros');
	});

	it('rejects a brand already in the dataset', async () => {
		const res = await post('/request/brand', { name: 'Nestle' });
		expect(res.status).toBe(400);
		expect(github.writes()).toHaveLength(0);
	});
});

describe('/report/inaccuracy', () => {
	it('opens one issue per company and comments each report on it', async () => {
		await post('/report/inaccuracy', { companyId: 'nestle', note: 'first' });
		await post('/report/inaccuracy', { companyId: 'nestle', note: 'second' });
		expect(github.issues).toHaveLength(1);
		expect(github.issues[0].title).toBe('Data correction: Nestlé');
		expect(github.calls.filter((c) => c.path.endsWith('/comments'))).toHaveLength(2);
	});

	it('rejects an unknown company', async () => {
		const res = await post('/report/inaccuracy', { companyId: 'nobody', note: 'x' });
		expect(res.status).toBe(400);
	});
});

describe('/submit/flag', () => {
	it('opens a PR appending an unverified flag', async () => {
		const res = await post('/submit/flag', { companyId: 'nestle', flag: validFlag });
		expect(await res.json()).toEqual({ prUrl: 'https://github.com/owner/repo/pull/1' });

		const put = github.calls.find((c) => c.method === 'PUT')!;
		expect(put.body).toMatchObject({ sha: 'sha-data/companies/nestle.json' });
		expect(put.body!.branch).toMatch(/^contribution\/new-flag-nestle-/);
		const written = JSON.parse(Buffer.from(put.body!.content as string, 'base64').toString());
		expect(written.flags).toEqual([expect.objectContaining({ ...validFlag, status: 'unverified' })]);
	});

	it.each([
		['unknown category', { companyId: 'nestle', flag: { ...validFlag, category: 'made-up' } }],
		['bad severity', { companyId: 'nestle', flag: { ...validFlag, severity: 'huge' } }],
		['path traversal id', { companyId: '../secrets', flag: validFlag }],
		['unknown company', { companyId: 'nobody', flag: validFlag }]
	])('rejects %s without writing', async (_, body) => {
		const res = await post('/submit/flag', body);
		expect(res.status).toBe(400);
		expect(github.writes()).toHaveLength(0);
	});
});

describe('/submit/company', () => {
	it('opens a PR with a new company file', async () => {
		const res = await post('/submit/company', { name: 'Acme Foods', country: 'CH', flags: [validFlag] });
		expect(res.status).toBe(200);
		const put = github.calls.find((c) => c.method === 'PUT')!;
		expect(put.path).toBe(`${REPO}/contents/data/companies/acme-foods.json`);
		expect(put.body).not.toHaveProperty('sha');
	});

	it('rejects an existing slug, no flags, and too many flags', async () => {
		expect((await post('/submit/company', { name: 'Nestle', flags: [validFlag] })).status).toBe(400);
		expect((await post('/submit/company', { name: 'Acme', flags: [] })).status).toBe(400);
		const six = Array.from({ length: 6 }, () => validFlag);
		expect((await post('/submit/company', { name: 'Acme', flags: six })).status).toBe(400);
		expect(github.writes()).toHaveLength(0);
	});
});

describe('/submit/barcode', () => {
	it('adds the mapping in a PR', async () => {
		github.files.set('data/products/barcode-overrides.json', { '40000000': 'nestle' });
		await post('/submit/barcode', { gtin: '7610000000000', companyId: 'nestle' });
		const put = github.calls.find((c) => c.method === 'PUT')!;
		const written = JSON.parse(Buffer.from(put.body!.content as string, 'base64').toString());
		expect(written).toEqual({ '40000000': 'nestle', '7610000000000': 'nestle' });
	});

	it('rejects a malformed or already-mapped barcode', async () => {
		github.files.set('data/products/barcode-overrides.json', { '40000000': 'nestle' });
		expect((await post('/submit/barcode', { gtin: 'abc', companyId: 'nestle' })).status).toBe(400);
		expect((await post('/submit/barcode', { gtin: '40000000', companyId: 'nestle' })).status).toBe(400);
		expect(github.writes()).toHaveLength(0);
	});
});
