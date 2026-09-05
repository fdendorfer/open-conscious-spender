<script lang="ts">
	import { ownershipChain, type Company, type Dataset } from '$lib/dataset';
	import { scoreCompany } from '$lib/scoring';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';

	let { company, dataset }: { company: Company; dataset: Dataset } = $props();

	let { score, band } = $derived(scoreCompany(company.flags, dataset.categories));
	let chain = $derived(ownershipChain(dataset, company));
</script>

<div
	class="flex flex-col items-center gap-4 rounded-2xl p-8 sm:p-10"
	class:bg-green-100={band === 'green'}
	class:bg-yellow-100={band === 'yellow'}
	class:bg-red-100={band === 'red'}
>
	<span class="text-center text-lg font-medium">
		{chain.map((c) => c.name).join(' → ')}
	</span>
	<div class="flex flex-wrap justify-center gap-4">
		{#each company.flags as flag (flag.category + flag.description)}
			{@const category = dataset.categories.find((c) => c.id === flag.category)}
			{@const Icon = category ? CATEGORY_ICONS[category.icon] : undefined}
			{#if Icon}
				<div class="flex flex-col items-center gap-1" title={category?.name}>
					<Icon size={40} weight={flag.status === 'sourced' ? 'fill' : 'regular'} />
				</div>
			{/if}
		{/each}
	</div>
	<span class="text-4xl font-semibold">{score}</span>
</div>
