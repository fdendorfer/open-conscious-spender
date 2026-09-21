import { browser } from '$app/environment';

const STORAGE_KEY = 'ocs-search-history';
const LIMIT = 10;

function read(): string[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === 'string').slice(0, LIMIT);
	} catch {
		return [];
	}
}

function write(ids: string[]) {
	if (!browser) return;
	try {
		if (ids.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		// storage blocked (private mode) — state still works for this session
	}
}

/**
 * The last {@link LIMIT} companies opened from the search box, most recent first,
 * offered as prefilled options when the query is empty. Stores ids rather than
 * queries so entries are re-resolved against the current dataset on every render.
 */
class SearchHistory {
	ids = $state<string[]>([]);

	hydrate() {
		this.ids = read();
	}

	record(companyId: string) {
		this.ids = [companyId, ...this.ids.filter((id) => id !== companyId)].slice(0, LIMIT);
		write(this.ids);
	}

	clear() {
		this.ids = [];
		write(this.ids);
	}
}

export const searchHistory = new SearchHistory();
