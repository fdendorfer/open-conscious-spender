export interface Env {
	GITHUB_PAT: string;
	GITHUB_OWNER: string;
	GITHUB_REPO: string;
	GITHUB_DEFAULT_BRANCH: string;
	ALLOWED_ORIGIN: string;
}

export const SEVERITIES = ['minor', 'moderate', 'severe', 'systemic'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface FlagInput {
	category: string;
	description: string;
	severity: Severity;
	sourceUrl: string | null;
}

export interface Category {
	id: string;
	[key: string]: unknown;
}
