<script lang="ts">
	import { resolve } from '$app/paths';
	import { ownershipChain, type Company, type Dataset } from '$lib/dataset';
	import { scoreCompany, flagContribution, saturate, SEVERITY_MULTIPLIER } from '$lib/scoring';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';

	let { company, dataset }: { company: Company; dataset: Dataset } = $props();

	let { score, band, rawPos, rawNeg } = $derived(scoreCompany(company.flags, dataset.categories));
	let chain = $derived(ownershipChain(dataset, company));

	let redFlags = $derived(
		company.flags
			.filter((f) => (f.polarity ?? 'negative') === 'negative')
			.map((flag) => {
				const category = dataset.categories.find((c) => c.id === flag.category);
				const points = category ? flagContribution(flag, category.defaultWeight) : 0;
				const Icon = category ? CATEGORY_ICONS[category.icon] : undefined;
				return { flag, category, points, Icon };
			})
			.sort((a, b) => b.points - a.points)
	);

	let greenFlags = $derived(
		company.flags
			.filter((f) => f.polarity === 'positive')
			.map((flag) => {
				const category = dataset.categories.find((c) => c.id === flag.category);
				const points = category ? flagContribution(flag, category.defaultWeight) : 0;
				const Icon = category ? CATEGORY_ICONS[category.icon] : undefined;
				return { flag, category, points, Icon };
			})
			.sort((a, b) => b.points - a.points)
	);

	type CategoryRow = { name: string; redPts: number; greenPts: number };
	let categoryBreakdown = $derived(
		(() => {
			const cats = new Map<string, CategoryRow>();
			for (const { flag, category, points } of redFlags) {
				const key = flag.category;
				const e = cats.get(key) ?? { name: category?.name ?? key, redPts: 0, greenPts: 0 };
				cats.set(key, { ...e, redPts: e.redPts + points });
			}
			for (const { flag, category, points } of greenFlags) {
				const key = flag.category;
				const e = cats.get(key) ?? { name: category?.name ?? key, redPts: 0, greenPts: 0 };
				cats.set(key, { ...e, greenPts: e.greenPts + points });
			}
			return [...cats.values()].sort((a, b) => b.redPts - b.greenPts - (a.redPts - a.greenPts));
		})()
	);

	const CONFIDENCE_LABEL: Record<string, string> = { sourced: '1.0', unverified: '0.6' };

	const BAND_LABEL: Record<string, string> = {
		green: 'Low concern',
		yellow: 'Neutral / insufficient data',
		red: 'High concern'
	};

	const SEVERITY_COLOR: Record<string, string> = {
		minor: 'bg-gray-100 text-gray-600',
		moderate: 'bg-yellow-100 text-yellow-800',
		severe: 'bg-orange-100 text-orange-800',
		systemic: 'bg-red-100 text-red-800'
	};

	// Shared inline style for the popover shell: transparent, anchor-positioned below the trigger.
	// inset:auto overrides the UA's centering (inset:0 + margin:auto).
	function popoverStyle(pid: string) {
		return [
			'position:fixed',
			`position-anchor:--${pid}`,
			'inset:auto',
			'top:calc(anchor(bottom) + 6px)',
			'right:calc(100vw - anchor(right))',
			'margin:0',
			'border:none',
			'padding:0',
			'background:transparent',
			'overflow:visible',
			'width:auto',
			'max-width:none',
		].join(';');
	}
</script>

<div class="grid gap-8 lg:grid-cols-[1fr_300px]">
	<!-- Main content: order-2 on mobile (after score), spans both sidebar rows on desktop -->
	<div class="order-2 flex min-w-0 flex-col gap-6 overflow-hidden lg:col-start-1 lg:row-start-1 lg:row-span-2">
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

		<!-- Red flags -->
		<div class="flex flex-col gap-3">
			<h2 class="font-medium text-red-600">
				Red flags
				<span class="ml-1 text-sm font-normal text-gray-400">({redFlags.length})</span>
			</h2>

			{#if redFlags.length === 0}
				<p class="text-sm text-gray-400">No red flags recorded.</p>
			{:else}
				{#each redFlags as { flag, category, points, Icon }, i}
					{@const pid = `${company.id}-r${i}`}
					<div class="flex flex-col gap-2 rounded-xl border border-red-100 p-4">
						<div class="flex flex-wrap items-center gap-2">
							{#if Icon}<Icon size={16} />{/if}
							<span class="text-sm font-medium">{category?.name ?? flag.category}</span>
							<span class="rounded-full px-2 py-0.5 text-xs {SEVERITY_COLOR[flag.severity] ?? ''}">
								{flag.severity}
							</span>
							{#if flag.status === 'sourced'}
								<span class="text-xs text-green-600">✓ Sourced</span>
							{:else}
								<span class="text-xs text-gray-400">○ Unverified</span>
							{/if}
							<span class="ml-auto flex items-center gap-1.5">
								<span class="font-mono text-xs text-red-400">−{points.toFixed(1)} pts</span>
								<button
									popovertarget={pid}
									style="anchor-name: --{pid}"
									class="text-xs text-gray-300 hover:text-gray-500"
									aria-label="Scoring details"
								>ⓘ</button>
							</span>
						</div>
						<p class="text-sm text-gray-700">{flag.description}</p>
						{#if flag.sourceUrl}
							<a
								href={flag.sourceUrl}
								target="_blank"
								rel="noreferrer external"
								class="break-all text-xs text-blue-600 hover:underline">{flag.sourceUrl}</a
							>
						{/if}
						{#if flag.dateAdded}
							<span class="text-xs text-gray-400">Added {flag.dateAdded}</span>
						{/if}

						<!-- Popover shell (transparent, anchor-positioned) wraps the visible card -->
						<div id={pid} popover style={popoverStyle(pid)}>
							<div class="w-64 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-xl">
								<p class="mb-3 text-xs font-medium text-gray-700">How −{points.toFixed(1)} pts was scored</p>
								<div class="flex flex-col gap-1.5 text-xs">
									<div class="flex justify-between gap-6 text-gray-500">
										<span>Category weight</span>
										<span class="font-mono">×{category?.defaultWeight ?? 1}</span>
									</div>
									<div class="flex justify-between gap-6 text-gray-500">
										<span>Severity ({flag.severity})</span>
										<span class="font-mono">×{SEVERITY_MULTIPLIER[flag.severity] ?? 1}</span>
									</div>
									<div class="flex justify-between gap-6 text-gray-500">
										<span>Confidence ({flag.status})</span>
										<span class="font-mono">×{CONFIDENCE_LABEL[flag.status] ?? '1.0'}</span>
									</div>
									<div class="mt-1 flex justify-between gap-6 border-t border-gray-100 pt-1.5 font-medium text-gray-700">
										<span>Raw contribution</span>
										<span class="font-mono">{points.toFixed(1)} pts</span>
									</div>
								</div>
								<p class="mt-3 text-xs text-gray-400">Additional flags in the same direction count for progressively less.</p>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Green flags -->
		<div class="flex flex-col gap-3">
			<h2 class="font-medium text-green-600">
				Green flags
				<span class="ml-1 text-sm font-normal text-gray-400">({greenFlags.length})</span>
			</h2>

			{#if greenFlags.length === 0}
				<p class="text-sm text-gray-400">No green flags recorded.</p>
			{:else}
				{#each greenFlags as { flag, category, points, Icon }, i}
					{@const pid = `${company.id}-g${i}`}
					<div class="flex flex-col gap-2 rounded-xl border border-green-100 p-4">
						<div class="flex flex-wrap items-center gap-2">
							{#if Icon}<Icon size={16} />{/if}
							<span class="text-sm font-medium">{category?.name ?? flag.category}</span>
							<span class="rounded-full px-2 py-0.5 text-xs {SEVERITY_COLOR[flag.severity] ?? ''}">
								{flag.severity}
							</span>
							{#if flag.status === 'sourced'}
								<span class="text-xs text-green-600">✓ Sourced</span>
							{:else}
								<span class="text-xs text-gray-400">○ Unverified</span>
							{/if}
							<span class="ml-auto flex items-center gap-1.5">
								<span class="font-mono text-xs text-green-600">+{points.toFixed(1)} pts</span>
								<button
									popovertarget={pid}
									style="anchor-name: --{pid}"
									class="text-xs text-gray-300 hover:text-gray-500"
									aria-label="Scoring details"
								>ⓘ</button>
							</span>
						</div>
						<p class="text-sm text-gray-700">{flag.description}</p>
						{#if flag.sourceUrl}
							<a
								href={flag.sourceUrl}
								target="_blank"
								rel="noreferrer external"
								class="break-all text-xs text-blue-600 hover:underline">{flag.sourceUrl}</a
							>
						{/if}
						{#if flag.dateAdded}
							<span class="text-xs text-gray-400">Added {flag.dateAdded}</span>
						{/if}

						<!-- Popover shell (transparent, anchor-positioned) wraps the visible card -->
						<div id={pid} popover style={popoverStyle(pid)}>
							<div class="w-64 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-xl">
								<p class="mb-3 text-xs font-medium text-gray-700">How +{points.toFixed(1)} pts was scored</p>
								<div class="flex flex-col gap-1.5 text-xs">
									<div class="flex justify-between gap-6 text-gray-500">
										<span>Category weight</span>
										<span class="font-mono">×{category?.defaultWeight ?? 1}</span>
									</div>
									<div class="flex justify-between gap-6 text-gray-500">
										<span>Severity ({flag.severity})</span>
										<span class="font-mono">×{SEVERITY_MULTIPLIER[flag.severity] ?? 1}</span>
									</div>
									<div class="flex justify-between gap-6 text-gray-500">
										<span>Confidence ({flag.status})</span>
										<span class="font-mono">×{CONFIDENCE_LABEL[flag.status] ?? '1.0'}</span>
									</div>
									<div class="mt-1 flex justify-between gap-6 border-t border-gray-100 pt-1.5 font-medium text-gray-700">
										<span>Raw contribution</span>
										<span class="font-mono">{points.toFixed(1)} pts</span>
									</div>
								</div>
								<p class="mt-3 text-xs text-gray-400">Additional flags in the same direction count for progressively less.</p>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Score card: order-1 on mobile (first), desktop right col row 1 -->
	<div class="order-1 lg:col-start-2 lg:row-start-1">
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
			<!-- Score gauge -->
			<div class="relative mt-3 w-full">
				<!-- Downward triangle marker positioned at the score -->
				<div class="relative mb-1 h-2">
					<div
						class="absolute bottom-0"
						style="left: clamp(0px, calc({score}% - 4px), calc(100% - 8px)); width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #374151;"
					></div>
				</div>
				<!-- Zone bar: red · yellow · green -->
				<div class="flex h-2 w-full gap-[2px]">
					<div class="flex-[33] rounded-l-full bg-red-400"></div>
					<div class="flex-[32] bg-yellow-300"></div>
					<div class="flex-[35] rounded-r-full bg-green-400"></div>
				</div>
				<!-- Scale labels -->
				<div class="mt-1.5 flex justify-between text-xs text-gray-400">
					<span>0</span>
					<span>50</span>
					<span>100</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Breakdown + parent: order-3 on mobile (last), desktop right col row 2 -->
	<div class="order-3 flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
		<!-- Score breakdown -->
		<div class="flex flex-col gap-4 rounded-xl border border-gray-200 p-4">
			<h3 class="text-sm font-medium">How the score was calculated</h3>

			<!-- Summary -->
			<div class="flex flex-col gap-1 text-xs">
				<div class="flex justify-between text-gray-500">
					<span>Baseline (no data)</span>
					<span class="font-mono">50</span>
				</div>
				{#if greenFlags.length > 0}
					<div class="flex justify-between text-green-600">
						<span>Positive signals</span>
						<span class="font-mono">+{saturate(rawPos).toFixed(1)}</span>
					</div>
				{/if}
				{#if redFlags.length > 0}
					<div class="flex justify-between text-red-500">
						<span>Concerns</span>
						<span class="font-mono">−{saturate(rawNeg).toFixed(1)}</span>
					</div>
				{/if}
				<div class="mt-1 flex justify-between border-t border-gray-100 pt-1.5 font-medium">
					<span>Score</span>
					<span class="font-mono">{score}</span>
				</div>
			</div>

			<!-- By category -->
			{#if categoryBreakdown.length > 0}
				<div class="flex flex-col gap-1.5">
					<p class="mb-0.5 text-xs font-medium text-gray-500">By category</p>
					{#each categoryBreakdown as { name, redPts, greenPts }}
						<div class="flex items-center justify-between gap-2 text-xs">
							<span class="min-w-0 flex-1 truncate text-gray-600">{name}</span>
							<div class="flex shrink-0 gap-3">
								{#if greenPts > 0}
									<span class="font-mono text-green-600">+{greenPts.toFixed(1)}</span>
								{/if}
								{#if redPts > 0}
									<span class="font-mono text-red-400">−{redPts.toFixed(1)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-xs text-gray-400">No flags recorded yet — score defaults to 50.</p>
			{/if}

			<!-- Expandable: how points work -->
			<details class="border-t border-gray-100 pt-3">
				<summary class="cursor-pointer select-none text-xs text-gray-400 hover:text-gray-600">
					How points work
				</summary>
				<div class="mt-3 flex flex-col gap-2 text-xs text-gray-500">
					<div class="flex flex-col gap-1">
						{#each Object.entries(SEVERITY_MULTIPLIER) as [sev, mult]}
							<div class="flex items-center gap-2">
								<span class="rounded-full px-2 py-0.5 {SEVERITY_COLOR[sev] ?? ''}">{sev}</span>
								<span class="text-gray-400">×{mult}</span>
							</div>
						{/each}
					</div>
					<p>Unverified flags count at 60%.</p>
					<p>Additional flags in the same direction count for progressively less — so no single issue or initiative can pin a score to 0 or 100.</p>
				</div>
			</details>
		</div>

		<!-- Parent company chain -->
		{#if chain.length > 1}
			<div class="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
				<h3 class="text-sm font-medium">Parent company</h3>
				<div class="flex flex-col gap-1">
					{#each chain as c, i}
						<div class="flex items-center gap-1 text-sm" style:padding-left="{i * 12}px">
							{#if i > 0}<span class="text-xs text-gray-300">↳</span>{/if}
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
