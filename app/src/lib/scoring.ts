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

// Bidirectional score: 50 = neutral (no data), 100 = strongly positive, 0 = strongly negative.
export const SCORE_BANDS = {
	red: [0, 33],
	yellow: [34, 65],
	green: [66, 100]
} as const;
export type Band = keyof typeof SCORE_BANDS;

export interface Flag {
	category: string;
	severity: Severity;
	status: FlagStatus;
	polarity?: 'positive' | 'negative'; // defaults to 'negative'
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
		if (weight === undefined) return sum;
		return sum + flagContribution(flag, weight);
	}, 0);
}

/**
 * Converts a raw flag weight into a 0–50 component.
 * Maps 0 → 0 and ∞ → 50 with diminishing returns.
 */
export function saturate(raw: number): number {
	return 50 * (1 - Math.exp(-raw / SATURATION_K));
}

export function scoreBand(score: number): Band {
	if (score >= SCORE_BANDS.green[0]) return 'green';
	if (score >= SCORE_BANDS.yellow[0]) return 'yellow';
	return 'red';
}

/**
 * Bidirectional score:
 * - No flags → 50 (neutral / no data)
 * - Green flags push toward 100
 * - Red flags push toward 0
 *
 * score = 50 + saturate(rawPositive) − saturate(rawNegative)
 */
export function scoreCompany(
	flags: Flag[],
	categories: CategoryWeight[]
): { score: number; band: Band; rawPos: number; rawNeg: number } {
	const negFlags = flags.filter((f) => (f.polarity ?? 'negative') === 'negative');
	const posFlags = flags.filter((f) => f.polarity === 'positive');

	const rawNeg = rawScore(negFlags, categories);
	const rawPos = rawScore(posFlags, categories);

	const score = Math.round(50 + saturate(rawPos) - saturate(rawNeg));
	return { score, band: scoreBand(score), rawPos, rawNeg };
}
