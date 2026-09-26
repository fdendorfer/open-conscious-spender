<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Trash, X } from 'phosphor-svelte';
	import { findCompanyById, loadDataset, type Dataset } from '$lib/dataset';
	import { scanTrip } from '$lib/scanTrip.svelte';
	import { scoreCompany, type Band } from '$lib/scoring';

	let dataset = $state<Dataset | null>(null);

	onMount(() => {
		void loadDataset().then((d) => (dataset = d));
	});

	const BAND_TEXT: Record<Band, string> = {
		green: 'text-green-600 dark:text-green-400',
		yellow: 'text-yellow-600 dark:text-yellow-400',
		red: 'text-red-600 dark:text-red-400'
	};

	let items = $derived(
		dataset
			? scanTrip.entries
					.map((entry) => {
						const company = findCompanyById(dataset!, entry.companyId);
						return company
							? { company, ...scoreCompany(company.flags, dataset!.categories) }
							: null;
					})
					.filter((item) => item !== null)
			: []
	);

	// The basket's own score: the average of what it is made of.
	let average = $derived(
		items.length ? Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length) : 0
	);
</script>

{#if items.length > 0}
	<section class="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5 dark:border-zinc-700">
		<div class="flex items-baseline gap-3">
			<h2 class="text-sm font-medium">This trip</h2>
			<span class="text-xs text-gray-500 dark:text-zinc-400">
				{items.length} scanned · average
				<span
					class="font-semibold {BAND_TEXT[
						average >= 34 ? 'green' : average >= -33 ? 'yellow' : 'red'
					]}">{average}</span
				>
			</span>
			<button
				class="ml-auto flex cursor-pointer items-center gap-1 text-xs text-gray-500 underline dark:text-zinc-400"
				onclick={() => scanTrip.clear()}
			>
				<Trash size={14} />
				Clear
			</button>
		</div>

		<ul class="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800">
			{#each items as item (item.company.id)}
				<li class="flex items-center gap-3 py-2">
					<a
						class="min-w-0 flex-1 truncate text-sm hover:underline"
						href={resolve('/brand/[slug]', { slug: item.company.id })}
					>
						{item.company.name}
					</a>
					<span class="text-sm font-semibold {BAND_TEXT[item.band]}">{item.score}</span>
					<button
						class="cursor-pointer rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
						aria-label="Remove {item.company.name} from this trip"
						onclick={() => scanTrip.remove(item.company.id)}
					>
						<X size={14} />
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
