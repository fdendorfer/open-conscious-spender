import { browser } from '$app/environment';

const ENABLED_KEY = 'ocs-shopping-mode';
const INTRO_SEEN_KEY = 'ocs-shopping-intro-seen';

function read(key: string): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(key) === '1';
	} catch {
		return false;
	}
}

function write(key: string, value: boolean) {
	if (!browser) return;
	try {
		if (value) localStorage.setItem(key, '1');
		else localStorage.removeItem(key);
	} catch {
		// storage blocked (private mode) — state still works for this session
	}
}

/**
 * Shopping mode turns barcode scanning into the primary lookup path: the navbar
 * search button opens the camera instead of the name search. Survives reloads
 * because the app is a PWA that may restart mid-aisle.
 *
 * State starts `false` on both server and client and is filled in by `hydrate()`
 * after mount, so SSR markup and the first client render always agree.
 */
class ShoppingMode {
	enabled = $state(false);
	introSeen = $state(false);

	hydrate() {
		this.enabled = read(ENABLED_KEY);
		this.introSeen = read(INTRO_SEEN_KEY);
	}

	enable() {
		this.enabled = true;
		write(ENABLED_KEY, true);
	}

	disable() {
		this.enabled = false;
		write(ENABLED_KEY, false);
	}

	markIntroSeen() {
		this.introSeen = true;
		write(INTRO_SEEN_KEY, true);
	}
}

export const shoppingMode = new ShoppingMode();
