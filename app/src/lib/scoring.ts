// Implements docs/SCORING.md. Keep this file and that doc in sync.

export const SEVERITY_MULTIPLIER = {
	minor: 1,
	moderate: 2,
	severe: 3,
	systemic: 5
} as const;
export type Severity = keyof typeof SEVERITY_MULTIPLIER;

export const CONFIDENCE_MULTIPLIER = {
	sourced: 1.0,
	unverified: 0.6
} as const;
export type FlagStatus = keyof typeof CONFIDENCE_MULTIPLIER;

/** Saturation constant — see docs/SCORING.md for the reasoning and example table. */
export const SATURATION_K = 12;

// Score is a "goodness" score: 100 = no concerning flags, 0 = heavily flagged.
export const SCORE_BANDS = {
	red: [0, 35],
	yellow: [36, 70],
	green: [71, 100]
} as const;
export type Band = keyof typeof SCORE_BANDS;

export interface Flag {
	category: string;
	severity: Severity;
	status: FlagStatus;
	decayMultiplier?: number; // reserved extension point; defaults to 1
}

/** Only the fields the scoring formula reads — the real dataset Category type (see dataset.ts) has more. */
export interface CategoryWeight {
	id: string;
	defaultWeight: number;
}

export function flagContribution(flag: Flag, categoryWeight: number): number {
	return (
		categoryWeight *
		SEVERITY_MULTIPLIER[flag.severity] *
		CONFIDENCE_MULTIPLIER[flag.status] *
		(flag.decayMultiplier ?? 1)
	);
}

export function rawScore(flags: Flag[], categories: CategoryWeight[]): number {
	const weightById = new Map(categories.map((c) => [c.id, c.defaultWeight]));
	return flags.reduce((sum, flag) => {
		const weight = weightById.get(flag.category);
		if (weight === undefined) return sum; // unknown category — ignore rather than throw
		return sum + flagContribution(flag, weight);
	}, 0);
}

/** Converts raw flag weight into a 0-100 goodness score — 100 is best, 0 is worst. */
export function normalizeScore(raw: number): number {
	return Math.round(100 * Math.exp(-raw / SATURATION_K));
}

export function scoreBand(score: number): Band {
	if (score >= SCORE_BANDS.green[0]) return 'green';
	if (score >= SCORE_BANDS.yellow[0]) return 'yellow';
	return 'red';
}

export function scoreCompany(
	flags: Flag[],
	categories: CategoryWeight[]
): { score: number; band: Band } {
	const score = normalizeScore(rawScore(flags, categories));
	return { score, band: scoreBand(score) };
}
