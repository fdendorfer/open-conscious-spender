const API = 'https://api.github.com';

function utf8ToBase64(str: string): string {
	const bytes = new TextEncoder().encode(str);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToUtf8(b64: string): string {
	const binary = atob(b64.replace(/\n/g, ''));
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

export interface GithubConfig {
	owner: string;
	repo: string;
	defaultBranch: string;
	token: string;
}

function headers(token: string) {
	return {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'open-conscious-spender-pr-bot'
	};
}

async function gh(config: GithubConfig, path: string, init: RequestInit = {}) {
	const res = await fetch(`${API}${path}`, {
		...init,
		headers: { ...headers(config.token), ...init.headers }
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed: ${res.status} ${body}`);
	}
	return res.json();
}

export async function fetchPublicJson(config: GithubConfig, path: string): Promise<unknown> {
	// public repo content — no auth needed, avoids burning the bot token's rate limit on reads
	const res = await fetch(
		`https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.defaultBranch}/${path}`
	);
	if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
	return res.json();
}

/** Returns existing file's sha + parsed JSON content, or null if the file doesn't exist yet. */
export async function getFile(
	config: GithubConfig,
	path: string
): Promise<{ sha: string; json: unknown } | null> {
	try {
		const data = (await gh(
			config,
			`/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.defaultBranch}`
		)) as { sha: string; content: string };
		const json = JSON.parse(base64ToUtf8(data.content));
		return { sha: data.sha, json };
	} catch {
		return null;
	}
}

export async function createBranch(config: GithubConfig, branchName: string): Promise<void> {
	const ref = (await gh(
		config,
		`/repos/${config.owner}/${config.repo}/git/ref/heads/${config.defaultBranch}`
	)) as { object: { sha: string } };

	await gh(config, `/repos/${config.owner}/${config.repo}/git/refs`, {
		method: 'POST',
		body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: ref.object.sha })
	});
}

export async function putFile(
	config: GithubConfig,
	branchName: string,
	path: string,
	json: unknown,
	message: string,
	existingSha: string | null
): Promise<void> {
	await gh(config, `/repos/${config.owner}/${config.repo}/contents/${path}`, {
		method: 'PUT',
		body: JSON.stringify({
			message,
			content: utf8ToBase64(JSON.stringify(json, null, 2) + '\n'),
			branch: branchName,
			...(existingSha ? { sha: existingSha } : {})
		})
	});
}

export async function openPullRequest(
	config: GithubConfig,
	branchName: string,
	title: string,
	body: string
): Promise<string> {
	const pr = (await gh(config, `/repos/${config.owner}/${config.repo}/pulls`, {
		method: 'POST',
		body: JSON.stringify({ title, head: branchName, base: config.defaultBranch, body })
	})) as { html_url: string };
	return pr.html_url;
}

export interface Issue {
	number: number;
	title: string;
	body: string | null;
	html_url: string;
	pull_request?: unknown;
}

const ISSUE_PAGE_SIZE = 100;
const MAX_ISSUE_PAGES = 5;

/** Open issues carrying `label`, newest first. Uses the list endpoint rather than the search
 *  API because search is index-lagged and would let duplicate requests through. */
export async function listOpenIssues(config: GithubConfig, label: string): Promise<Issue[]> {
	const issues: Issue[] = [];
	for (let page = 1; page <= MAX_ISSUE_PAGES; page++) {
		const batch = (await gh(
			config,
			`/repos/${config.owner}/${config.repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=${ISSUE_PAGE_SIZE}&page=${page}`
		)) as Issue[];
		issues.push(...batch.filter((i) => !i.pull_request));
		if (batch.length < ISSUE_PAGE_SIZE) break;
	}
	return issues;
}

export async function createIssue(
	config: GithubConfig,
	title: string,
	body: string,
	labels: string[]
): Promise<Issue> {
	return (await gh(config, `/repos/${config.owner}/${config.repo}/issues`, {
		method: 'POST',
		body: JSON.stringify({ title, body, labels })
	})) as Issue;
}

export async function updateIssue(
	config: GithubConfig,
	number: number,
	fields: { title?: string; body?: string }
): Promise<void> {
	await gh(config, `/repos/${config.owner}/${config.repo}/issues/${number}`, {
		method: 'PATCH',
		body: JSON.stringify(fields)
	});
}

export async function commentOnIssue(
	config: GithubConfig,
	number: number,
	body: string
): Promise<void> {
	await gh(config, `/repos/${config.owner}/${config.repo}/issues/${number}/comments`, {
		method: 'POST',
		body: JSON.stringify({ body })
	});
}

/** Existence check against raw.githubusercontent, which doesn't spend the bot token's API budget. */
export async function publicFileExists(config: GithubConfig, path: string): Promise<boolean> {
	const res = await fetch(
		`https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.defaultBranch}/${path}`,
		{ method: 'HEAD' }
	);
	return res.ok;
}
