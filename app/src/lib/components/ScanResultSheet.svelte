<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, Barcode } from 'phosphor-svelte';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';
	import { scoreCompany, type Band } from '$lib/scoring';
	import type { Company, Dataset } from '$lib/dataset';

	let {
		company,
		dataset,
		onScanNext
	}: {
		company: Company;
		dataset: Dataset;
		onScanNext: () => void;
	} = $props();

	let { score, band } = $derived(scoreCompany(company.flags, dataset.categories));

	const BAND_SURFACE: Record<Band, string> = {
		green: 'bg-green-50 dark:bg-green-950',
		yellow: 'bg-yellow-50 dark:bg-yellow-950',
		red: 'bg-red-50 dark:bg-red-950'
	};

	const BAND_TEXT: Record<Band, string> = {
		green: 'text-green-600 dark:text-green-400',
		yellow: 'text-yellow-600 dark:text-yellow-400',
		red: 'text-red-600 dark:text-red-400'
	};

	const BAND_LABEL: Record<Band, string> = {
		green: 'Low concern',
		yellow: 'Neutral / little data',
		red: 'High concern'
	};

	// Distinct flag categories, worst-weighted first — the at-a-glance "why".
	let concerns = $derived(
		[
			...new Set(
				company.flags
					.filter((f) => (f.polarity ?? 'negative') === 'negative')
					.map((f) => f.category)
			)
		]
			.map((id) => dataset.categories.find((c) => c.id === id))
			.filter((c) => c !== undefined)
			.sort((a, b) => b.defaultWeight - a.defaultWeight)
	);

	let positives = $derived(
		[...new Set(company.flags.filter((f) => f.polarity === 'positive').map((f) => f.category))]
			.map((id) => dataset.categories.find((c) => c.id === id))
			.filter((c) => c !== undefined)
	);
</script>

<div class="flex flex-col gap-4 p-5">
	<div class="flex items-start gap-4">
		<div class="min-w-0 flex-1">
			<h2 class="truncate text-xl font-semibold text-gray-900 dark:text-zinc-100">
				{company.name}
			</h2>
			<p class="mt-0.5 text-sm font-medium {BAND_TEXT[band]}">
				{BAND_LABEL[band]}
			</p>
		</div>
		<div
			class="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl {BAND_SURFACE[
				band
			]}"
		>
			<span class="text-2xl leading-none font-bold {BAND_TEXT[band]}">{score}</span>
			<span class="mt-0.5 text-[10px] tracking-wide text-gray-500 uppercase dark:text-zinc-300"
				>score</span
			>
		</div>
	</div>

	{#if concerns.length > 0}
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-300"
				>Concerns</span
			>
			<ul class="flex flex-wrap gap-1.5">
				{#each concerns as category (category.id)}
					{@const Icon = CATEGORY_ICONS[category.icon]}
					<li
						class="flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
					>
						{#if Icon}<Icon size={14} />{/if}
						{category.name}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if positives.length > 0}
		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-300"
				>Positive signals</span
			>
			<ul class="flex flex-wrap gap-1.5">
				{#each positives as category (category.id)}
					{@const Icon = CATEGORY_ICONS[category.icon]}
					<li
						class="flex items-center gap-1.5 rounded-lg bg-green-50 px-2 py-1 text-xs text-green-700 dark:bg-green-950 dark:text-green-300"
					>
						{#if Icon}<Icon size={14} />{/if}
						{category.name}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if concerns.length === 0 && positives.length === 0}
		<p class="text-sm text-gray-500 dark:text-zinc-300">No flags recorded yet for this company.</p>
	{/if}

	<div class="flex flex-col gap-2 pt-1">
		<button
			class="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
			onclick={onScanNext}
		>
			<Barcode size={20} />
			Scan next item
		</button>
		<a
			class="flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-sm text-gray-600 underline dark:text-zinc-300"
			href={resolve('/brand/[slug]', { slug: company.id })}
		>
			View full details
			<ArrowRight size={14} />
		</a>
	</div>
</div>
