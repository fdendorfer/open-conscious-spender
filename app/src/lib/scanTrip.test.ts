import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';

const KEY = 'ocs-scan-trip';
const HOUR = 60 * 60 * 1000;

async function load() {
	vi.resetModules();
	return (await import('./scanTrip.svelte')).scanTrip;
}

beforeEach(() => {
	vi.stubGlobal('localStorage', memoryStorage());
	vi.useFakeTimers({ now: new Date('2026-10-11T10:00:00Z') });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('scanTrip', () => {
	it('records most recent first and moves a re-scan to the front', async () => {
		const trip = await load();
		trip.record('a');
		vi.advanceTimersByTime(1000);
		trip.record('b');
		vi.advanceTimersByTime(1000);
		trip.record('a');
		expect(trip.entries.map((e) => e.companyId)).toEqual(['a', 'b']);
	});

	it('caps the trip at 50 entries', async () => {
		const trip = await load();
		for (let i = 0; i < 60; i++) trip.record(`c${i}`);
		expect(trip.entries).toHaveLength(50);
		expect(trip.entries[0].companyId).toBe('c59');
	});

	it('persists and hydrates', async () => {
		(await load()).record('a');
		const trip = await load();
		trip.hydrate();
		expect(trip.entries.map((e) => e.companyId)).toEqual(['a']);
	});

	it('starts a new trip after a 4h gap', async () => {
		const trip = await load();
		trip.record('a');
		vi.advanceTimersByTime(4 * HOUR + 1);
		trip.record('b');
		expect(trip.entries.map((e) => e.companyId)).toEqual(['b']);
	});

	it('drops a stale trip on hydrate', async () => {
		(await load()).record('a');
		vi.advanceTimersByTime(5 * HOUR);
		const trip = await load();
		trip.hydrate();
		expect(trip.entries).toEqual([]);
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it('ignores malformed storage', async () => {
		localStorage.setItem(
			KEY,
			JSON.stringify([{ companyId: 'a', at: Date.now() }, { companyId: 1 }, null])
		);
		const trip = await load();
		trip.hydrate();
		expect(trip.entries.map((e) => e.companyId)).toEqual(['a']);

		localStorage.setItem(KEY, '{not json');
		trip.hydrate();
		expect(trip.entries).toEqual([]);
	});

	it('removes one entry and clears storage when emptied', async () => {
		const trip = await load();
		trip.record('a');
		trip.record('b');
		trip.remove('a');
		expect(trip.entries.map((e) => e.companyId)).toEqual(['b']);
		trip.clear();
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it('keeps working when storage throws', async () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		const trip = await load();
		trip.hydrate();
		trip.record('a');
		expect(trip.entries.map((e) => e.companyId)).toEqual(['a']);
	});
});
