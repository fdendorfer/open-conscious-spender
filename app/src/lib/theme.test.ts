import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';

const KEY = 'ocs-theme';

let systemDark: boolean;
let systemListener: ((e: { matches: boolean }) => void) | undefined;
let classes: Set<string>;
let themeColor: string | undefined;

async function load() {
	vi.resetModules();
	return (await import('./theme.svelte')).theme;
}

beforeEach(() => {
	systemDark = false;
	systemListener = undefined;
	classes = new Set();
	themeColor = undefined;
	vi.stubGlobal('localStorage', memoryStorage());
	vi.stubGlobal('window', {
		matchMedia: () => ({
			get matches() {
				return systemDark;
			},
			addEventListener: (_: string, fn: typeof systemListener) => (systemListener = fn)
		})
	});
	vi.stubGlobal('document', {
		documentElement: {
			classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) }
		},
		querySelector: () => ({ setAttribute: (_: string, v: string) => (themeColor = v) })
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('theme', () => {
	it('follows the OS when nothing is stored', async () => {
		systemDark = true;
		const theme = await load();
		theme.hydrate();
		expect(theme.setting).toBe('system');
		expect(theme.resolved).toBe('dark');
		expect(classes.has('dark')).toBe(true);
		expect(themeColor).toBe('#09090b');
	});

	it('reacts to an OS change while on system', async () => {
		const theme = await load();
		theme.hydrate();
		systemDark = true;
		systemListener?.({ matches: true });
		expect(theme.resolved).toBe('dark');
		expect(classes.has('dark')).toBe(true);
	});

	it('a stored setting overrides the OS', async () => {
		systemDark = true;
		localStorage.setItem(KEY, 'light');
		const theme = await load();
		theme.hydrate();
		expect(theme.resolved).toBe('light');
		expect(themeColor).toBe('#ffffff');
	});

	it('ignores an unknown stored value', async () => {
		localStorage.setItem(KEY, 'sepia');
		const theme = await load();
		theme.hydrate();
		expect(theme.setting).toBe('system');
	});

	it('toggle writes the explicit opposite of what is on screen', async () => {
		systemDark = true;
		const theme = await load();
		theme.hydrate();
		theme.toggle();
		expect(theme.setting).toBe('light');
		expect(localStorage.getItem(KEY)).toBe('light');
		theme.toggle();
		expect(theme.setting).toBe('dark');
	});

	it("set('system') removes the stored value", async () => {
		const theme = await load();
		theme.set('dark');
		theme.set('system');
		expect(localStorage.getItem(KEY)).toBeNull();
	});
});
