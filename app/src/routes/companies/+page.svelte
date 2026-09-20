<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadDataset, type Company, type Dataset } from '$lib/dataset';
	import { scoreCompany, type Band } from '$lib/scoring';

	const BAND_DOT: Record<Band, string> = {
		green: 'bg-green-500 dark:bg-green-400',
		yellow: 'bg-yellow-500 dark:bg-yellow-400',
		red: 'bg-red-500 dark:bg-red-400'
	};

	type SortKey = 'name' | 'country' | 'score' | 'flags';
	type SortDir = 'asc' | 'desc';

	let dataset = $state<Dataset | null>(null);
	let filter = $state('');
	let sortKey = $state<SortKey>('score');
	let sortDir = $state<SortDir>('desc');

	function scored(company: Company) {
		const { score, band } = dataset
			? scoreCompany(company.flags, dataset.categories)
			: { score: 100, band: 'green' as const };
		return { company, score, band, flags: company.flags.length };
	}

	let rows = $derived(
		dataset
			? dataset.companies
					.map(scored)
					.filter((r) => r.company.name.toLowerCase().includes(filter.toLowerCase()))
					.sort((a, b) => {
						let cmp = 0;
						if (sortKey === 'name') cmp = a.company.name.localeCompare(b.company.name);
						else if (sortKey === 'country')
							cmp = (a.company.country ?? '').localeCompare(b.company.country ?? '');
						else if (sortKey === 'score') cmp = a.score - b.score;
						else if (sortKey === 'flags') cmp = a.flags - b.flags;
						return sortDir === 'asc' ? cmp : -cmp;
					})
			: []
	);

	function sortBy(key: SortKey) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = key === 'score' || key === 'flags' ? 'desc' : 'asc';
		}
	}

	function chevron(key: SortKey) {
		if (sortKey !== key) return '↕';
		return sortDir === 'asc' ? '↑' : '↓';
	}

	onMount(async () => {
		dataset = await loadDataset();
	});
</script>

<svelte:head>
	<title>Companies — Conscious</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-6 py-10">
	<h1 class="mb-6 text-2xl font-semibold">Companies reviewed</h1>

	<input
		class="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 dark:border-zinc-700 dark:placeholder:text-zinc-400 dark:focus:border-zinc-600"
		placeholder="Filter by name…"
		bind:value={filter}
	/>

	{#if !dataset}
		<p class="text-sm text-gray-400 dark:text-zinc-400">Loading…</p>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700">
			<table class="w-full text-sm">
				<thead
					class="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
				>
					<tr>
						<th class="px-4 py-3">
							<button
								class="flex items-center gap-1 hover:text-gray-900 dark:hover:text-zinc-100"
								onclick={() => sortBy('name')}
							>
								Company <span class="text-gray-300 dark:text-zinc-500">{chevron('name')}</span>
							</button>
						</th>
						<th class="px-4 py-3">
							<button
								class="flex items-center gap-1 hover:text-gray-900 dark:hover:text-zinc-100"
								onclick={() => sortBy('country')}
							>
								Country <span class="text-gray-300 dark:text-zinc-500">{chevron('country')}</span>
							</button>
						</th>
						<th class="px-4 py-3">
							<button
								class="flex items-center gap-1 hover:text-gray-900 dark:hover:text-zinc-100"
								onclick={() => sortBy('score')}
							>
								Score <span class="text-gray-300 dark:text-zinc-500">{chevron('score')}</span>
							</button>
						</th>
						<th class="px-4 py-3">
							<button
								class="flex items-center gap-1 hover:text-gray-900 dark:hover:text-zinc-100"
								onclick={() => sortBy('flags')}
							>
								Flags <span class="text-gray-300 dark:text-zinc-500">{chevron('flags')}</span>
							</button>
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white dark:divide-zinc-800 dark:bg-transparent">
					{#each rows as { company, score, band, flags } (company.id)}
						<tr class="hover:bg-gray-50 dark:hover:bg-zinc-900">
							<td class="px-4 py-3 font-medium">
								<a href={resolve('/brand/[slug]', { slug: company.id })} class="hover:underline">
									{company.name}
								</a>
							</td>
							<td class="px-4 py-3 text-gray-500 dark:text-zinc-300">{company.country ?? '—'}</td>
							<td class="px-4 py-3">
								<span class="flex items-center gap-2">
									<span class="h-2 w-2 shrink-0 rounded-full {BAND_DOT[band]}"></span>
									{score}
								</span>
							</td>
							<td class="px-4 py-3 text-gray-500 dark:text-zinc-300">{flags}</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr>
							<td class="px-4 py-6 text-center text-gray-400 dark:text-zinc-400" colspan="4"
								>No companies match your filter.</td
							>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
		<p class="mt-3 text-xs text-gray-400 dark:text-zinc-400">
			{rows.length} of {dataset.companies.length} companies
		</p>
	{/if}
</main>
