import { get, set } from 'idb-keyval';
import * as publicEnv from '$env/static/public';

// Static, not $env/dynamic/public: the dynamic module is served at runtime from
// /_app/env.js, which cannot be precached, so it broke every offline visit.
// Set via the PUBLIC_PR_BOT_URL env var once workers/pr-bot is deployed (see its README).
const PR_BOT_URL = (publicEnv as Record<string, string | undefined>).PUBLIC_PR_BOT_URL ?? '';

const DRAFTS_KEY = 'ocs-local-drafts';
const SUBMISSION_LOG_KEY = 'ocs-submission-log';
const REQUEST_LOG_KEY = 'ocs-request-log';
const MAX_SUBMISSIONS_PER_DAY = 10;
// Requests are one tap and carry no claims, so they get a looser budget than sourced
// submissions — a single trip through a supermarket can easily miss ten brands.
const MAX_REQUESTS_PER_DAY = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DraftKind = 'company' | 'flag' | 'barcode';

export interface Draft {
	id: string;
	kind: DraftKind;
	payload: Record<string, unknown>;
	createdAt: string;
	submitted: boolean;
	prUrl?: string;
	/** Failed background resends; caps retries so a rejected payload stops eventually. */
	attempts?: number;
}

export async function listDrafts(): Promise<Draft[]> {
	return (await get<Draft[]>(DRAFTS_KEY)) ?? [];
}

export async function saveDraft(kind: DraftKind, payload: Record<string, unknown>): Promise<Draft> {
	const draft: Draft = {
		id: crypto.randomUUID(),
		kind,
		payload,
		createdAt: new Date().toISOString(),
		submitted: false
	};
	const drafts = await listDrafts();
	await set(DRAFTS_KEY, [...drafts, draft]);
	return draft;
}

/** On-device rate limit: {@link MAX_SUBMISSIONS_PER_DAY} submissions per rolling 24h.
 *  Chosen over a server-side limit because it needs no backend state at all — see docs/ARCHITECTURE.md. */
export function submissionsRemainingToday(): number {
	return Math.max(0, MAX_SUBMISSIONS_PER_DAY - readLog(SUBMISSION_LOG_KEY).length);
}

export function requestsRemainingToday(): number {
	return Math.max(0, MAX_REQUESTS_PER_DAY - readLog(REQUEST_LOG_KEY).length);
}

function readLog(key: string): number[] {
	const raw = localStorage.getItem(key);
	const timestamps: number[] = raw ? JSON.parse(raw) : [];
	const cutoff = Date.now() - DAY_MS;
	return timestamps.filter((t) => t > cutoff);
}

function record(key: string): void {
	localStorage.setItem(key, JSON.stringify([...readLog(key), Date.now()]));
}

const ENDPOINT_BY_KIND: Record<DraftKind, string> = {
	company: '/submit/company',
	flag: '/submit/flag',
	barcode: '/submit/barcode'
};

export class RateLimitedError extends Error {}
export class SubmissionFailedError extends Error {}

export async function submitDraft(draft: Draft): Promise<string> {
	if (!PR_BOT_URL) {
		throw new SubmissionFailedError('Contribution submission is not configured yet.');
	}
	if (submissionsRemainingToday() <= 0) {
		throw new RateLimitedError(
			`You've reached today's limit of ${MAX_SUBMISSIONS_PER_DAY} submissions. Try again tomorrow.`
		);
	}

	const res = await fetch(`${PR_BOT_URL}${ENDPOINT_BY_KIND[draft.kind]}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(draft.payload)
	});
	const body = (await res.json()) as { prUrl?: string; error?: string };
	if (!res.ok || !body.prUrl) {
		throw new SubmissionFailedError(body.error ?? `Submission failed (${res.status})`);
	}

	record(SUBMISSION_LOG_KEY);
	const drafts = await listDrafts();
	await set(
		DRAFTS_KEY,
		drafts.map((d) => (d.id === draft.id ? { ...d, submitted: true, prUrl: body.prUrl } : d))
	);
	return body.prUrl;
}

async function postToBot<T>(path: string, payload: unknown): Promise<T> {
	if (!PR_BOT_URL) {
		throw new SubmissionFailedError('Contribution submission is not configured yet.');
	}
	const res = await fetch(`${PR_BOT_URL}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const body = (await res.json()) as T & { error?: string };
	if (!res.ok) throw new SubmissionFailedError(body.error ?? `Request failed (${res.status})`);
	return body;
}

export interface BrandRequestResult {
	issueUrl: string;
	requestCount: number;
}

/** One-tap "please rate this brand" — no flags, no sourcing. Repeat requests for the same
 *  brand land on one deduplicated GitHub issue and bump its counter. */
export async function requestBrand(
	name: string,
	gtin?: string | null,
	note?: string | null
): Promise<BrandRequestResult> {
	if (requestsRemainingToday() <= 0) {
		throw new RateLimitedError(
			`You've reached today's limit of ${MAX_REQUESTS_PER_DAY} requests. Try again tomorrow.`
		);
	}
	const result = await postToBot<BrandRequestResult>('/request/brand', {
		name,
		gtin: gtin ?? null,
		note: note?.trim() || null
	});
	record(REQUEST_LOG_KEY);
	return result;
}

export async function reportInaccuracy(companyId: string, note: string): Promise<string> {
	if (requestsRemainingToday() <= 0) {
		throw new RateLimitedError(
			`You've reached today's limit of ${MAX_REQUESTS_PER_DAY} reports. Try again tomorrow.`
		);
	}
	const result = await postToBot<{ issueUrl: string }>('/report/inaccuracy', {
		companyId,
		note: note.trim()
	});
	record(REQUEST_LOG_KEY);
	return result.issueUrl;
}

/** A 4xx means the bot rejected the payload itself; retrying it would fail forever. */
function isPermanent(err: unknown): boolean {
	return err instanceof SubmissionFailedError && /\((4\d\d)\)$/.test(err.message);
}

const MAX_RETRY_ATTEMPTS = 5;

/**
 * Resends drafts stranded by a failed submit (offline mid-aisle is the common case).
 * Silent by design: the user was already told the contribution was saved.
 */
export async function retryPendingDrafts(): Promise<void> {
	if (!PR_BOT_URL) return;

	const drafts = await listDrafts();
	const pending = drafts.filter((d) => !d.submitted && (d.attempts ?? 0) < MAX_RETRY_ATTEMPTS);
	if (pending.length === 0) return;

	for (const draft of pending) {
		if (submissionsRemainingToday() <= 0) return;
		try {
			await submitDraft(draft);
		} catch (err) {
			if (err instanceof RateLimitedError) return;
			await bumpAttempts(draft.id, isPermanent(err));
		}
	}
}

async function bumpAttempts(id: string, permanent: boolean): Promise<void> {
	const drafts = await listDrafts();
	await set(
		DRAFTS_KEY,
		drafts.map((d) =>
			d.id === id ? { ...d, attempts: permanent ? MAX_RETRY_ATTEMPTS : (d.attempts ?? 0) + 1 } : d
		)
	);
}
