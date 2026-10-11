import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';

const KEY = 'ocs-search-history';

async function load() {
	vi.resetModules();
	return (await import('./searchHistory.svelte')).searchHistory;
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('searchHistory', () => {
	it('records most recent first without duplicates, capped at 10', async () => {
		const history = await load();
		for (let i = 0; i < 12; i++) history.record(`c${i}`);
		history.record('c5');
		expect(history.ids).toHaveLength(10);
		expect(history.ids.slice(0, 2)).toEqual(['c5', 'c11']);
	});

	it('persists and hydrates, dropping non-string ids', async () => {
		localStorage.setItem(KEY, JSON.stringify(['a', 2, 'b']));
		const history = await load();
		history.hydrate();
		expect(history.ids).toEqual(['a', 'b']);
	});

	it('clear removes the storage key', async () => {
		const history = await load();
		history.record('a');
		history.clear();
		expect(history.ids).toEqual([]);
		expect(localStorage.getItem(KEY)).toBeNull();
	});
});
