<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import {
		findCompanyById,
		searchCompaniesByName,
		type CompanySearchResult,
		type Dataset,
		type Company
	} from '$lib/dataset';
	import { scoreCompany, type Band } from '$lib/scoring';
	import { searchHistory } from '$lib/searchHistory.svelte';

	const BAND_DOT: Record<Band, string> = {
		green: 'bg-green-500 dark:bg-green-400',
		yellow: 'bg-yellow-500 dark:bg-yellow-400',
		red: 'bg-red-500 dark:bg-red-400'
	};

	let {
		dataset,
		placeholder = 'Search company name…',
		query = $bindable(''),
		floatResults = true,
		onSelect,
		onEnterNoResults,
		onEscape,
		emptyState
	}: {
		dataset: Dataset | null;
		placeholder?: string;
		query?: string;
		/** Float results over the page. Set false inside a panel that should grow instead. */
		floatResults?: boolean;
		onSelect?: (company: Company) => void;
		onEnterNoResults?: (query: string) => void;
		onEscape?: () => void;
		emptyState?: Snippet<[string]>;
	} = $props();

	let activeIndex = $state(-1);
	let focused = $state(false);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);

	// This component is mounted twice (page and navbar overlay), so the ids
	// aria-controls/aria-activedescendant point at have to be per-instance.
	const uid = $props.id();
	const listboxId = `${uid}-listbox`;
	const optionId = (index: number) => `${uid}-option-${index}`;

	let trimmedQuery = $derived(query.trim());
	let searching = $derived(trimmedQuery.length >= 2);

	let results = $derived(dataset && searching ? searchCompaniesByName(dataset, trimmedQuery) : []);

	let recent: CompanySearchResult[] = $derived(
		dataset && !trimmedQuery
			? searchHistory.ids
					.map((id) => findCompanyById(dataset, id))
					.filter((company): company is Company => company !== undefined)
					.map((company) => ({ company, matchedBrand: null }))
			: []
	);

	// Recent picks are an affordance for an empty, focused box — never an unprompted popover.
	let showRecent = $derived(!searching && focused && recent.length > 0);
	let rows = $derived(searching ? results : recent);
	let panelOpen = $derived(searching || showRecent);

	function rowBand(company: Company) {
		return dataset ? scoreCompany(company.flags, dataset.categories).band : 'green';
	}

	function selectCompany(company: Company) {
		searchHistory.record(company.id);
		if (onSelect) onSelect(company);
		else goto(resolve('/brand/[slug]', { slug: company.id }));
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, rows.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, -1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const picked =
				activeIndex >= 0 ? rows[activeIndex] : results.length === 1 ? results[0] : undefined;
			if (picked) selectCompany(picked.company);
			else if (searching && results.length === 0) onEnterNoResults?.(trimmedQuery);
		} else if (e.key === 'Escape') {
			query = '';
			activeIndex = -1;
			onEscape?.();
		}
	}

	export function focus() {
		inputEl?.focus();
	}
</script>

<div class="relative">
	<input
		bind:this={inputEl}
		class="w-full rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-400"
		{placeholder}
		role="combobox"
		aria-expanded={panelOpen}
		aria-controls={panelOpen ? listboxId : undefined}
		aria-autocomplete="list"
		aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
		autocomplete="off"
		bind:value={query}
		oninput={() => (activeIndex = -1)}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		onkeydown={onKeydown}
	/>

	<p class="sr-only" aria-live="polite">
		{#if searching}
			{results.length === 0 ? `No match for ${trimmedQuery}` : `${results.length} companies found`}
		{/if}
	</p>

	{#if panelOpen}
		<!-- Keeping focus in the input on mousedown lets a row's click land before blur closes the panel. -->
		<div
			class="mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-800 dark:shadow-black/60 {floatResults
				? 'absolute z-10'
				: 'max-h-[min(50vh,20rem)] overflow-y-auto'}"
			onmousedown={(e) => e.preventDefault()}
			role="presentation"
		>
			{#if showRecent}
				<p class="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 dark:text-zinc-400">
					Recent searches
				</p>
			{/if}

			{#if rows.length > 0}
				<!-- Options are not focusable by design: the input keeps focus and drives
				     selection through aria-activedescendant, per the ARIA combobox pattern. -->
				<ul id={listboxId} role="listbox" aria-label="Company results">
					{#each rows as { company, matchedBrand }, i (company.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<li
							id={optionId(i)}
							role="option"
							aria-selected={i === activeIndex}
							class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left last:rounded-b-xl {showRecent
								? ''
								: 'first:rounded-t-xl'} {i === activeIndex ? 'bg-gray-100 dark:bg-zinc-700' : ''}"
							onclick={() => selectCompany(company)}
							onmouseenter={() => (activeIndex = i)}
						>
							<span class="h-2 w-2 shrink-0 rounded-full {BAND_DOT[rowBand(company)]}"></span>
							{#if matchedBrand}
								{matchedBrand}
								<span class="text-gray-400 dark:text-zinc-400">({company.name})</span>
							{:else}
								{company.name}
							{/if}
						</li>
					{/each}
				</ul>
			{:else if emptyState}
				{@render emptyState(trimmedQuery)}
			{:else}
				<p class="p-3 text-sm text-gray-500 dark:text-zinc-300">No match for "{query}".</p>
			{/if}
		</div>
	{/if}
</div>
