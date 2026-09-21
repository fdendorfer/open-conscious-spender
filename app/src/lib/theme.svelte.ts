import { browser } from '$app/environment';

const STORAGE_KEY = 'ocs-theme';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Kept in sync with the `html` background in layout.css and the inline script in app.html. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#09090b' };

function readSetting(): ThemeSetting {
	if (!browser) return 'system';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored === 'light' || stored === 'dark' ? stored : 'system';
	} catch {
		return 'system';
	}
}

function writeSetting(setting: ThemeSetting) {
	if (!browser) return;
	try {
		if (setting === 'system') localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, setting);
	} catch {
		// storage blocked (private mode) — state still works for this session
	}
}

/**
 * Colour theme, persisted under `ocs-theme`. The stored setting is tri-state so an
 * untouched install keeps following the OS, but the toggle only writes explicit values.
 *
 * State starts at the default on both server and client and is filled in by `hydrate()`
 * after mount; the inline script in `app.html` prevents a flash until then.
 */
class Theme {
	#setting = $state<ThemeSetting>('system');
	#systemDark = $state(false);
	#watchingSystem = false;

	/** The stored preference, including `'system'`. */
	get setting(): ThemeSetting {
		return this.#setting;
	}

	/** The theme actually rendered, with `'system'` resolved against the OS preference. */
	resolved: ResolvedTheme = $derived(
		this.#setting === 'system' ? (this.#systemDark ? 'dark' : 'light') : this.#setting
	);

	hydrate() {
		if (!browser) return;
		this.#setting = readSetting();

		const query = window.matchMedia('(prefers-color-scheme: dark)');
		this.#systemDark = query.matches;
		if (!this.#watchingSystem) {
			query.addEventListener('change', (e) => {
				this.#systemDark = e.matches;
				this.#apply();
			});
			this.#watchingSystem = true;
		}

		this.#apply();
	}

	set(setting: ThemeSetting) {
		this.#setting = setting;
		writeSetting(setting);
		this.#apply();
	}

	/** Switches to the explicit opposite of what is on screen; never back to `'system'`. */
	toggle() {
		this.#setting = this.resolved === 'dark' ? 'light' : 'dark';
		writeSetting(this.#setting);
		this.#apply();
	}

	#apply() {
		if (!browser) return;
		const active = this.resolved;
		document.documentElement.classList.toggle('dark', active === 'dark');
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', THEME_COLOR[active]);
	}
}

export const theme = new Theme();
