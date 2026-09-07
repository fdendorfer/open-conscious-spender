<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadDataset, type Company, type Dataset } from '$lib/dataset';
	import { scoreCompany } from '$lib/scoring';

	let dataset = $state<Dataset | null>(null);
	let companies = $derived<Company[]>(
		dataset ? [...dataset.companies].sort((a, b) => a.name.localeCompare(b.name)) : []
	);

	function band(company: Company) {
		return dataset ? scoreCompany(company.flags, dataset.categories).band : 'green';
	}

	onMount(async () => {
		dataset = await loadDataset();
	});
</script>

<svelte:head>
	<title>Companies — Conscious</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-10">
	<h1 class="mb-6 text-2xl font-semibold">Companies reviewed</h1>

	{#if !dataset}
		<p class="text-sm text-gray-500">Loading…</p>
	{:else}
		<ul class="flex flex-col divide-y divide-gray-100">
			{#each companies as company (company.id)}
				{@const b = band(company)}
				<li>
					<a
						href={resolve('/brand/[slug]', { slug: company.id })}
						class="flex items-center gap-3 py-3 text-sm hover:text-gray-600"
					>
						<span
							class="h-2 w-2 shrink-0 rounded-full"
							class:bg-green-500={b === 'green'}
							class:bg-yellow-500={b === 'yellow'}
							class:bg-red-500={b === 'red'}
						></span>
						<span class="flex-1 font-medium">{company.name}</span>
						{#if company.country}
							<span class="text-gray-400">{company.country}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
