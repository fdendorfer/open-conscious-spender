<script lang="ts">
	import { ownershipChain, type Company, type Dataset } from '$lib/dataset';
	import { scoreCompany, flagContribution } from '$lib/scoring';
	import CompanyHeader from './CompanyHeader.svelte';
	import FlagList from './FlagList.svelte';
	import ScoreCard from './ScoreCard.svelte';
	import ScoreBreakdown from './ScoreBreakdown.svelte';
	import OwnershipChain from './OwnershipChain.svelte';

	let { company, dataset }: { company: Company; dataset: Dataset } = $props();

	let { score, band, rawPos, rawNeg } = $derived(scoreCompany(company.flags, dataset.categories));
	let chain = $derived(ownershipChain(dataset, company));

	type CategoryRow = { id: string; name: string; redPts: number; greenPts: number };
	let categoryBreakdown = $derived.by(() => {
		const cats: Record<string, CategoryRow> = {};
		for (const flag of company.flags) {
			const category = dataset.categories.find((c) => c.id === flag.category);
			const points = category ? flagContribution(flag, category.defaultWeight) : 0;
			const row = (cats[flag.category] ??= {
				id: flag.category,
				name: category?.name ?? flag.category,
				redPts: 0,
				greenPts: 0
			});
			if ((flag.polarity ?? 'negative') === 'negative') row.redPts += points;
			else row.greenPts += points;
		}
		return Object.values(cats).sort((a, b) => b.redPts - b.greenPts - (a.redPts - a.greenPts));
	});
</script>

<div class="grid gap-8 lg:grid-cols-[1fr_300px]">
	<!-- Main content: order-2 on mobile (after score), spans both sidebar rows on desktop -->
	<div
		class="order-2 flex min-w-0 flex-col gap-6 overflow-hidden lg:col-start-1 lg:row-span-2 lg:row-start-1"
	>
		<CompanyHeader {company} />
		<FlagList
			companyId={company.id}
			flags={company.flags}
			categories={dataset.categories}
			polarity="negative"
		/>
		<FlagList
			companyId={company.id}
			flags={company.flags}
			categories={dataset.categories}
			polarity="positive"
		/>
	</div>

	<!-- Score card: order-1 on mobile (first), desktop right col row 1 -->
	<div class="order-1 lg:col-start-2 lg:row-start-1">
		<ScoreCard {score} {band} />
	</div>

	<!-- Breakdown + parent: order-3 on mobile (last), desktop right col row 2 -->
	<div class="order-3 flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
		<ScoreBreakdown {rawPos} {rawNeg} {categoryBreakdown} />
		{#if chain.length > 1}
			<OwnershipChain {chain} />
		{/if}
	</div>
</div>
