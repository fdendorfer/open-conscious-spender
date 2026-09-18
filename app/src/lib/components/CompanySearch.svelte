<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { searchCompaniesByName, type Dataset, type Company } from '$lib/dataset';
	import { scoreCompany } from '$lib/scoring';

	let {
		dataset,
		placeholder = 'Search company name…',
		query = $bindable(''),
		onSelect,
		onEnterNoResults,
		onEscape,
		emptyState
	}: {
		dataset: Dataset | null;
		placeholder?: string;
		query?: string;
		onSelect?: (company: Company) => void;
		onEnterNoResults?: (query: string) => void;
		onEscape?: () => void;
		emptyState?: Snippet<[string]>;
	} = $props();

	let activeIndex = $state(-1);
	let inputEl = $state<HTMLInputElement | undefined>(undefined);

	let results = $derived(dataset ? searchCompaniesByName(dataset, query) : []);

	function rowBand(company: Company) {
		return dataset ? scoreCompany(company.flags, dataset.categories).band : 'green';
	}

	function selectCompany(company: Company) {
		if (onSelect) onSelect(company);
		else goto(resolve('/brand/[slug]', { slug: company.id }));
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, -1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const picked =
				activeIndex >= 0 ? results[activeIndex] : results.length === 1 ? results[0] : undefined;
			if (picked) selectCompany(picked.company);
			else if (results.length === 0 && query.trim().length >= 2) onEnterNoResults?.(query.trim());
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
		class="w-full rounded-xl border border-gray-300 px-3 py-2"
		{placeholder}
		bind:value={query}
		oninput={() => (activeIndex = -1)}
		onkeydown={onKeydown}
	/>

	{#if query.trim().length >= 2}
		<div class="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
			{#if results.length > 0}
				<ul>
					{#each results as { company, matchedBrand }, i (company.id)}
						<li>
							<button
								class="flex w-full items-center gap-2 px-3 py-2 text-left first:rounded-t-xl last:rounded-b-xl"
								class:bg-gray-100={i === activeIndex}
								onclick={() => selectCompany(company)}
								onmouseenter={() => (activeIndex = i)}
							>
								<span
									class="h-2 w-2 shrink-0 rounded-full"
									class:bg-green-500={rowBand(company) === 'green'}
									class:bg-yellow-500={rowBand(company) === 'yellow'}
									class:bg-red-500={rowBand(company) === 'red'}
								></span>
								{#if matchedBrand}
									{matchedBrand} <span class="text-gray-400">({company.name})</span>
								{:else}
									{company.name}
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else if emptyState}
				{@render emptyState(query.trim())}
			{:else}
				<p class="p-3 text-sm text-gray-500">No match for "{query}".</p>
			{/if}
		</div>
	{/if}
</div>
