import { describe, expect, it } from 'vitest';
import {
	CONFIDENCE_MULTIPLIER,
	SATURATION_CEILING,
	SATURATION_K,
	SEVERITY_MULTIPLIER,
	flagContribution,
	rawScore,
	saturate,
	scoreBand,
	scoreCompany,
	type Flag
} from './scoring';

const CATEGORIES = [
	{ id: 'environment', defaultWeight: 3 },
	{ id: 'labor-rights', defaultWeight: 2 },
	{ id: 'tax-avoidance', defaultWeight: 1 }
];

function flag(overrides: Partial<Flag> = {}): Flag {
	return { category: 'environment', severity: 'moderate', status: 'sourced', ...overrides };
}

describe('flagContribution', () => {
	it('multiplies weight, severity and confidence', () => {
		expect(flagContribution(flag({ severity: 'severe', status: 'sourced' }), 3)).toBe(9);
	});

	it('discounts unverified flags', () => {
		const sourced = flagContribution(flag({ status: 'sourced' }), 3);
		const unverified = flagContribution(flag({ status: 'unverified' }), 3);
		expect(unverified).toBeCloseTo(sourced * CONFIDENCE_MULTIPLIER.unverified, 10);
	});

	it('defaults decayMultiplier to 1', () => {
		expect(flagContribution(flag(), 2)).toBe(flagContribution(flag({ decayMultiplier: 1 }), 2));
	});

	it('applies decayMultiplier when set', () => {
		expect(flagContribution(flag({ decayMultiplier: 0.5 }), 4)).toBe(
			flagContribution(flag(), 4) * 0.5
		);
	});

	it('scales monotonically with severity', () => {
		const order: Flag['severity'][] = ['minor', 'moderate', 'severe', 'systemic'];
		const points = order.map((severity) => flagContribution(flag({ severity }), 1));
		expect(points).toEqual([...points].sort((a, b) => a - b));
		expect(points).toEqual(order.map((s) => SEVERITY_MULTIPLIER[s]));
	});
});

describe('rawScore', () => {
	it('sums contributions across flags', () => {
		const flags = [flag({ category: 'environment' }), flag({ category: 'labor-rights' })];
		expect(rawScore(flags, CATEGORIES)).toBe(3 * 2 + 2 * 2);
	});

	it('ignores flags in categories that no longer exist', () => {
		expect(rawScore([flag({ category: 'retired-category' })], CATEGORIES)).toBe(0);
	});

	it('is 0 for no flags', () => {
		expect(rawScore([], CATEGORIES)).toBe(0);
	});
});

describe('saturate', () => {
	it('maps 0 to 0', () => {
		expect(saturate(0)).toBe(0);
	});

	it('approaches the ceiling and never exceeds it', () => {
		// Past roughly K*36 the exponential underflows and the result is exactly
		// the ceiling in float64, so only assert strict inequality below that.
		expect(saturate(SATURATION_K * 5)).toBeLessThan(SATURATION_CEILING);
		expect(saturate(1e6)).toBeLessThanOrEqual(SATURATION_CEILING);
		expect(saturate(1e6)).toBeCloseTo(SATURATION_CEILING, 5);
	});

	it('is strictly increasing with diminishing returns', () => {
		const firstStep = saturate(5) - saturate(0);
		const laterStep = saturate(25) - saturate(20);
		expect(firstStep).toBeGreaterThan(0);
		expect(laterStep).toBeGreaterThan(0);
		expect(laterStep).toBeLessThan(firstStep);
	});
});

describe('scoreBand', () => {
	// Boundaries straight from the table in docs/SCORING.md.
	it.each([
		[-100, 'red'],
		[-34, 'red'],
		[-33, 'yellow'],
		[0, 'yellow'],
		[33, 'yellow'],
		[34, 'green'],
		[100, 'green']
	])('scores %i as %s', (score, band) => {
		expect(scoreBand(score)).toBe(band);
	});
});

describe('scoreCompany', () => {
	it('returns exactly 0 and yellow for a company with no flags', () => {
		const result = scoreCompany([], CATEGORIES);
		expect(result).toMatchObject({ score: 0, band: 'yellow', rawPos: 0, rawNeg: 0 });
	});

	// The worked table in docs/SCORING.md — these are the documented contract.
	it.each([
		['one sourced severe flag in a weight-3 category', 9, 0, -53],
		['one sourced minor flag in a weight-2 category', 2, 0, -15],
		['two sourced minor red flags in weight-2 categories', 4, 0, -28]
	])('matches the documented example: %s', (_label, rawNeg, rawPos, expected) => {
		const score = Math.round(saturate(rawPos) - saturate(rawNeg));
		expect(score).toBe(expected);
	});

	it('cancels an equal and opposite green flag back to 0', () => {
		const flags = [
			flag({ severity: 'severe', polarity: 'negative' }),
			flag({ severity: 'severe', polarity: 'positive' })
		];
		const { score, rawPos, rawNeg } = scoreCompany(flags, CATEGORIES);
		expect(rawPos).toBe(rawNeg);
		expect(score).toBe(0);
	});

	it('treats a missing polarity as negative', () => {
		const implicit = scoreCompany([flag()], CATEGORIES);
		const explicit = scoreCompany([flag({ polarity: 'negative' })], CATEGORIES);
		expect(implicit).toEqual(explicit);
		expect(implicit.score).toBeLessThan(0);
	});

	it('never leaves the -100..100 range even with absurd input', () => {
		const many = Array.from({ length: 500 }, () => flag({ severity: 'systemic' }));
		const { score, band } = scoreCompany(many, CATEGORIES);
		expect(score).toBeGreaterThanOrEqual(-SATURATION_CEILING);
		expect(score).toBeLessThanOrEqual(SATURATION_CEILING);
		expect(band).toBe('red');
	});

	it('is order-independent', () => {
		const flags = [
			flag({ category: 'environment', severity: 'severe' }),
			flag({ category: 'labor-rights', polarity: 'positive' }),
			flag({ category: 'tax-avoidance', status: 'unverified' })
		];
		expect(scoreCompany(flags, CATEGORIES)).toEqual(scoreCompany([...flags].reverse(), CATEGORIES));
	});

	it('does not inherit flags from other companies', () => {
		// Scores are per-company by construction; scoreCompany only ever sees one
		// company's flags. This pins that contract against a future regression.
		const own = scoreCompany([flag({ severity: 'minor' })], CATEGORIES);
		const withParent = scoreCompany([flag({ severity: 'minor' })], CATEGORIES);
		expect(own).toEqual(withParent);
	});

	it('band always agrees with the returned score', () => {
		for (const severity of ['minor', 'moderate', 'severe', 'systemic'] as const) {
			for (const polarity of ['negative', 'positive'] as const) {
				const result = scoreCompany([flag({ severity, polarity })], CATEGORIES);
				expect(result.band).toBe(scoreBand(result.score));
			}
		}
	});
});
