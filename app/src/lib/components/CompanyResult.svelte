<script lang="ts">
	import { resolve } from '$app/paths';
	import { ownershipChain, type Company, type Dataset } from '$lib/dataset';
	import {
		scoreCompany,
		flagContribution,
		rawScore,
		SATURATION_K,
		SEVERITY_MULTIPLIER
	} from '$lib/scoring';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';

	let { company, dataset }: { company: Company; dataset: Dataset } = $props();

	let { score, band } = $derived(scoreCompany(company.flags, dataset.categories));
	let chain = $derived(ownershipChain(dataset, company));
	let raw = $derived(rawScore(company.flags, dataset.categories));

	let flagsWithMeta = $derived(
		company.flags
			.map((flag) => {
				const category = dataset.categories.find((c) => c.id === flag.category);
				const points = category ? flagContribution(flag, category.defaultWeight) : 0;
				const Icon = category ? CATEGORY_ICONS[category.icon] : undefined;
				return { flag, category, points, Icon };
			})
			.sort((a, b) => b.points - a.points)
	);

	const BAND_LABEL: Record<string, string> = {
		green: 'Low concern',
		yellow: 'Moderate concern',
		red: 'High concern'
	};

	const SEVERITY_COLOR: Record<string, string> = {
		minor: 'bg-gray-100 text-gray-600',
		moderate: 'bg-yellow-100 text-yellow-800',
		severe: 'bg-orange-100 text-orange-800',
		systemic: 'bg-red-100 text-red-800'
	};
</script>

<div class="grid gap-8 lg:grid-cols-[1fr_300px]">
	<!-- Main content -->
	<div class="flex flex-col gap-6">
		<!-- Company header -->
		<div>
			<h1 class="text-2xl font-semibold">{company.name}</h1>
			<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
				{#if company.country}<span>{company.country}</span>{/if}
				{#if company.aliases.length > 0}
					<span class="text-gray-300">·</span>
					<span class="text-xs">Also known as: {company.aliases.join(', ')}</span>
				{/if}
			</div>
		</div>

		<!-- Flags -->
		<div class="flex flex-col gap-3">
			<h2 class="font-medium">
				Flags
				<span class="ml-1 text-sm font-normal text-gray-400">({company.flags.length})</span>
			</h2>

			{#if company.flags.length === 0}
				<p class="text-sm text-gray-500">No flags recorded yet.</p>
			{:else}
				{#each flagsWithMeta as { flag, category, points, Icon }}
					<div class="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
						<div class="flex flex-wrap items-center gap-2">
							{#if Icon}
								<Icon size={16} />
							{/if}
							<span class="text-sm font-medium">{category?.name ?? flag.category}</span>
							<span class="rounded-full px-2 py-0.5 text-xs {SEVERITY_COLOR[flag.severity] ?? ''}">
								{flag.severity}
							</span>
							{#if flag.status === 'sourced'}
								<span class="text-xs text-green-600">✓ Sourced</span>
							{:else}
								<span class="text-xs text-gray-400">○ Unverified</span>
							{/if}
							<span class="ml-auto font-mono text-xs text-red-400">−{points.toFixed(1)} pts</span>
						</div>

						<p class="text-sm text-gray-700">{flag.description}</p>

						{#if flag.sourceUrl}
							<a
								href={flag.sourceUrl}
								target="_blank"
								rel="noreferrer external"
								class="truncate text-xs text-blue-600 hover:underline"
							>{flag.sourceUrl}</a>
						{/if}

						{#if flag.dateAdded}
							<span class="text-xs text-gray-400">Added {flag.dateAdded}</span>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Sidebar -->
	<div class="flex flex-col gap-4">
		<!-- Score card -->
		<div
			class="flex flex-col items-center gap-1 rounded-xl p-6 text-center"
			class:bg-green-50={band === 'green'}
			class:bg-yellow-50={band === 'yellow'}
			class:bg-red-50={band === 'red'}
		>
			<span class="text-xs font-medium uppercase tracking-wide text-gray-500">Score</span>
			<span
				class="text-6xl font-bold"
				class:text-green-600={band === 'green'}
				class:text-yellow-600={band === 'yellow'}
				class:text-red-600={band === 'red'}
			>{score}</span>
			<span
				class="text-sm font-medium"
				class:text-green-600={band === 'green'}
				class:text-yellow-600={band === 'yellow'}
				class:text-red-600={band === 'red'}
			>{BAND_LABEL[band]}</span>
			<p class="mt-2 text-xs text-gray-400">100 = no flags · 0 = heavily flagged</p>
		</div>

		<!-- Score breakdown -->
		<div class="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
			<h3 class="text-sm font-medium">Score breakdown</h3>

			{#if flagsWithMeta.length > 0}
				<div class="flex flex-col gap-1.5">
					{#each flagsWithMeta as { flag, category, points }}
						<div class="flex items-center gap-2 text-xs">
							<span class="min-w-0 flex-1 truncate text-gray-600"
								>{category?.name ?? flag.category}</span
							>
							<span class="shrink-0 text-gray-400">{flag.severity}</span>
							<span class="w-12 shrink-0 text-right font-mono font-medium text-red-400"
								>−{points.toFixed(1)}</span
							>
						</div>
					{/each}
					<div
						class="mt-0.5 flex items-center gap-2 border-t border-gray-100 pt-1.5 text-xs font-medium"
					>
						<span class="flex-1">Raw penalty</span>
						<span class="w-12 text-right font-mono">{raw.toFixed(1)}</span>
					</div>
				</div>
			{/if}

			<div class="rounded bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">
				score = 100 × e<sup>−{raw.toFixed(1)} ÷ {SATURATION_K}</sup> = {score}
			</div>

			<div class="flex flex-col gap-1 text-xs text-gray-500">
				{#each Object.entries(SEVERITY_MULTIPLIER) as [sev, mult]}
					<div class="flex items-center gap-2">
						<span class="rounded-full px-2 py-0.5 {SEVERITY_COLOR[sev] ?? ''}">{sev}</span>
						<span class="text-gray-400">×{mult}</span>
					</div>
				{/each}
				<p class="mt-1 text-gray-400">Unverified flags count at 60%.</p>
			</div>
		</div>

		<!-- Parent company chain -->
		{#if chain.length > 1}
			<div class="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
				<h3 class="text-sm font-medium">Parent company</h3>
				<div class="flex flex-col gap-1">
					{#each chain as c, i}
						<div class="flex items-center gap-1 text-sm" style:padding-left="{i * 12}px">
							{#if i > 0}<span class="text-gray-300 text-xs">↳</span>{/if}
							{#if i === 0}
								<span class="font-medium">{c.name}</span>
							{:else}
								<a
									href={resolve('/brand/[slug]', { slug: c.id })}
									class="text-blue-600 hover:underline">{c.name}</a
								>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
