import { get, set } from 'idb-keyval';
import { env } from '$env/dynamic/public';

// Set via the PUBLIC_PR_BOT_URL env var once workers/pr-bot is deployed (see its README).
const PR_BOT_URL = env.PUBLIC_PR_BOT_URL ?? '';

const DRAFTS_KEY = 'ocs-local-drafts';
const SUBMISSION_LOG_KEY = 'ocs-submission-log';
const MAX_SUBMISSIONS_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DraftKind = 'company' | 'flag' | 'barcode';

export interface Draft {
	id: string;
	kind: DraftKind;
	payload: Record<string, unknown>;
	createdAt: string;
	submitted: boolean;
	prUrl?: string;
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
	const log = readSubmissionLog();
	return Math.max(0, MAX_SUBMISSIONS_PER_DAY - log.length);
}

function readSubmissionLog(): number[] {
	const raw = localStorage.getItem(SUBMISSION_LOG_KEY);
	const timestamps: number[] = raw ? JSON.parse(raw) : [];
	const cutoff = Date.now() - DAY_MS;
	return timestamps.filter((t) => t > cutoff);
}

function recordSubmission(): void {
	const log = readSubmissionLog();
	log.push(Date.now());
	localStorage.setItem(SUBMISSION_LOG_KEY, JSON.stringify(log));
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

	recordSubmission();
	const drafts = await listDrafts();
	await set(
		DRAFTS_KEY,
		drafts.map((d) => (d.id === draft.id ? { ...d, submitted: true, prUrl: body.prUrl } : d))
	);
	return body.prUrl;
}
