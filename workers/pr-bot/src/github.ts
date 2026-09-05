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
