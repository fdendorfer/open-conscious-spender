import { browser } from '$app/environment';

const STORAGE_KEY = 'ocs-scan-trip';
const LIMIT = 50;

// A shopping trip is one visit to one shop. A longer gap than this means the
// next scan starts a new basket rather than adding to yesterday's.
const TRIP_GAP_MS = 4 * 60 * 60 * 1000;

export interface TripEntry {
	companyId: string;
	at: number;
}

function read(): TripEntry[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(e): e is TripEntry =>
				!!e && typeof e === 'object' && typeof e.companyId === 'string' && typeof e.at === 'number'
		);
	} catch {
		return [];
	}
}

function write(entries: TripEntry[]) {
	if (!browser) return;
	try {
		if (entries.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		// storage blocked (private mode) — the trip still works for this session
	}
}

/**
 * The companies scanned during the current shopping trip, most recent first.
 * Lets someone review the basket at the till instead of remembering each result,
 * and is what a "how did this trip go" summary is built from.
 */
class ScanTrip {
	entries = $state<TripEntry[]>([]);

	hydrate() {
		this.entries = read();
		this.expireStaleTrip();
	}

	private expireStaleTrip() {
		const newest = this.entries[0]?.at;
		if (newest !== undefined && Date.now() - newest > TRIP_GAP_MS) this.clear();
	}

	record(companyId: string) {
		this.expireStaleTrip();
		// Re-scanning the same product moves it to the front rather than duplicating it.
		this.entries = [
			{ companyId, at: Date.now() },
			...this.entries.filter((e) => e.companyId !== companyId)
		].slice(0, LIMIT);
		write(this.entries);
	}

	remove(companyId: string) {
		this.entries = this.entries.filter((e) => e.companyId !== companyId);
		write(this.entries);
	}

	clear() {
		this.entries = [];
		write(this.entries);
	}
}

export const scanTrip = new ScanTrip();
