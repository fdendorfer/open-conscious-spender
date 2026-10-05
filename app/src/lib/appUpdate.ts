import { browser } from '$app/environment';
import { updated } from '$app/state';
import { activateLatestWorker } from './workerUpdate';

const RELOAD_GUARD_KEY = 'ocs-update-reload-at';
const RELOAD_GUARD_MS = 60_000;

// A worker replacing another one, not the first install claiming the page.
let controllerChanged = false;
if (browser && 'serviceWorker' in navigator) {
	let hadController = navigator.serviceWorker.controller !== null;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (hadController) controllerChanged = true;
		hadController = true;
	});
}

/**
 * Asks the network (never the service worker cache) whether a newer build is deployed,
 * and if so swaps in the new build and reloads. Guarded so a stale CDN cannot cause a loop.
 */
export async function reloadIfOutdated(): Promise<void> {
	if (!browser || !navigator.onLine) return;
	let outdated: boolean;
	try {
		outdated = await updated.check();
	} catch {
		return;
	}
	if (!outdated) return;

	try {
		const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY));
		if (Date.now() - last < RELOAD_GUARD_MS) return;
		sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
	} catch {
		// storage blocked: without a guard, skip the automatic reload rather than risk a loop
		return;
	}
	try {
		if (await activateLatestWorker(navigator.serviceWorker, controllerChanged)) location.reload();
	} catch {
		// update failed, e.g. the connection dropped: keep running the cached build
	}
}
