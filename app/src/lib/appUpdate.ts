import { browser } from '$app/environment';
import { updated } from '$app/state';
import { reloadFromNetwork } from './deviceData';

const RELOAD_GUARD_KEY = 'ocs-update-reload-at';
const RELOAD_GUARD_MS = 60_000;

/**
 * Asks the network (never the service worker cache) whether a newer build is deployed,
 * and if so drops the cached app and reloads. Guarded so a stale CDN cannot cause a loop.
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
	await reloadFromNetwork();
}
