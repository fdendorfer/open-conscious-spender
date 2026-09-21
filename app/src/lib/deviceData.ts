import { browser } from '$app/environment';
import { clear as clearKeyval } from 'idb-keyval';

/** Every localStorage key the app writes is namespaced, so clearing can stay prefix-based. */
const KEY_PREFIX = 'ocs-';

export interface DeviceStorage {
	/** Total origin usage reported by the browser, or null where the API is unavailable. */
	usageBytes: number | null;
	appFilesCached: boolean;
}

async function appFilesCached(): Promise<boolean> {
	if (!browser || !('caches' in window)) return false;
	try {
		for (const name of await caches.keys()) {
			if (!name.includes('precache')) continue;
			const cache = await caches.open(name);
			if ((await cache.keys()).length > 0) return true;
		}
	} catch {
		// cache storage blocked (private mode, no service worker) — report as not cached
	}
	return false;
}

export async function readDeviceStorage(): Promise<DeviceStorage> {
	let usageBytes: number | null = null;
	try {
		usageBytes = (await navigator.storage?.estimate?.())?.usage ?? null;
	} catch {
		// estimate() unsupported or blocked — the size line is simply omitted
	}
	return { usageBytes, appFilesCached: await appFilesCached() };
}

/**
 * Waits for the service worker to finish precaching the app shell. Registration
 * itself happens in `registerSW.js`; this only reports whether it got there.
 */
export async function ensureAppFilesCached(): Promise<boolean> {
	if (!browser || !('serviceWorker' in navigator)) return false;
	const registration = await navigator.serviceWorker.getRegistration('/');
	if (!registration) return false;
	await navigator.serviceWorker.ready;
	return appFilesCached();
}

function clearNamespacedLocalStorage() {
	try {
		const keys = Object.keys(localStorage).filter((k) => k.startsWith(KEY_PREFIX));
		for (const key of keys) localStorage.removeItem(key);
	} catch {
		// storage blocked — nothing was written in the first place
	}
}

async function clearCaches() {
	if (!('caches' in window)) return;
	try {
		await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
	} catch {
		// cache storage blocked — nothing to remove
	}
}

async function unregisterServiceWorkers() {
	if (!('serviceWorker' in navigator)) return;
	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(registrations.map((r) => r.unregister()));
	} catch {
		// service workers unavailable — nothing to remove
	}
}

/**
 * Wipes every trace of the app on this device: settings, search history, drafts,
 * the cached dataset and the offline copy of the app itself.
 */
export async function clearDeviceData(): Promise<void> {
	if (!browser) return;
	clearNamespacedLocalStorage();
	await clearKeyval();
	await clearCaches();
	await unregisterServiceWorkers();
}
