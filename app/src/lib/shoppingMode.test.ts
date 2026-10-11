import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';

async function load() {
	vi.resetModules();
	return (await import('./shoppingMode.svelte')).shoppingMode;
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('shoppingMode', () => {
	it('starts disabled until hydrated', async () => {
		localStorage.setItem('ocs-shopping-mode', '1');
		const mode = await load();
		expect(mode.enabled).toBe(false);
		mode.hydrate();
		expect(mode.enabled).toBe(true);
	});

	it('persists enable, disable and the intro flag', async () => {
		const mode = await load();
		mode.enable();
		mode.markIntroSeen();
		expect(localStorage.getItem('ocs-shopping-mode')).toBe('1');
		expect(localStorage.getItem('ocs-shopping-intro-seen')).toBe('1');

		mode.disable();
		expect(mode.enabled).toBe(false);
		expect(localStorage.getItem('ocs-shopping-mode')).toBeNull();

		const reloaded = await load();
		reloaded.hydrate();
		expect(reloaded).toMatchObject({ enabled: false, introSeen: true });
	});
});
