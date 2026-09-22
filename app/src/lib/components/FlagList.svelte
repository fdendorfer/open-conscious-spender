<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Category, StoredFlag } from '$lib/dataset';
	import { flagContribution, SEVERITY_MULTIPLIER } from '$lib/scoring';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';

	let {
		companyId,
		flags,
		categories,
		polarity
	}: {
		companyId: string;
		flags: StoredFlag[];
		categories: Category[];
		polarity: 'negative' | 'positive';
	} = $props();

	const POLARITY_CONFIG = {
		negative: {
			label: 'Red flags',
			emptyText: 'No red flags recorded.',
			headingColor: 'text-red-600 dark:text-red-400',
			borderColor: 'border-red-100 dark:border-red-900/50',
			pointsColor: 'text-red-500 dark:text-red-400',
			sign: '−',
			idPrefix: 'r'
		},
		positive: {
			label: 'Green flags',
			emptyText: 'No green flags recorded.',
			headingColor: 'text-green-600 dark:text-green-400',
			borderColor: 'border-green-100 dark:border-green-900/50',
			pointsColor: 'text-green-600 dark:text-green-400',
			sign: '+',
			idPrefix: 'g'
		}
	} as const;
	let config = $derived(POLARITY_CONFIG[polarity]);

	let rows = $derived(
		flags
			.filter((f) => (f.polarity ?? 'negative') === polarity)
			.map((flag) => {
				const category = categories.find((c) => c.id === flag.category);
				const points = category ? flagContribution(flag, category.defaultWeight) : 0;
				const Icon = category ? CATEGORY_ICONS[category.icon] : undefined;
				return { flag, category, points, Icon };
			})
			.sort((a, b) => b.points - a.points)
	);

	const CONFIDENCE_LABEL: Record<string, string> = { sourced: '1.0', unverified: '0.6' };

	const SEVERITY_COLOR: Record<string, string> = {
		minor: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300',
		moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
		severe: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
		systemic: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
	};

	// Popovers render in the top layer with position:fixed, so they don't
	// follow the page on scroll/resize — track the trigger button live while open.
	let stopTrackingPopover: (() => void) | null = null;

	function positionPopover(e: Event) {
		const ev = e as ToggleEvent;
		const popoverEl = e.currentTarget as HTMLElement;

		if (ev.newState !== 'open') {
			stopTrackingPopover?.();
			stopTrackingPopover = null;
			return;
		}

		const button = document.querySelector<HTMLElement>(`[popovertarget="${popoverEl.id}"]`);
		if (!button) return;

		const reposition = () => {
			const rect = button.getBoundingClientRect();
			const popoverWidth = 256; // matches w-64
			const margin = 8;
			const left = Math.max(
				margin,
				Math.min(rect.right - popoverWidth, window.innerWidth - popoverWidth - margin)
			);
			popoverEl.style.margin = '0';
			popoverEl.style.inset = 'auto';
			popoverEl.style.top = `${rect.bottom + 6}px`;
			popoverEl.style.left = `${left}px`;
		};

		reposition();
		window.addEventListener('scroll', reposition, { passive: true, capture: true });
		window.addEventListener('resize', reposition);
		stopTrackingPopover?.();
		stopTrackingPopover = () => {
			window.removeEventListener('scroll', reposition, true);
			window.removeEventListener('resize', reposition);
		};
	}
</script>

<div class="flex flex-col gap-3">
	<h2 class="font-medium {config.headingColor}">
		{config.label}
		<span class="ml-1 text-sm font-normal text-gray-400 dark:text-zinc-400">({rows.length})</span>
	</h2>

	{#if rows.length === 0}
		<p class="text-sm text-gray-400 dark:text-zinc-400">{config.emptyText}</p>
	{:else}
		{#each rows as { flag, category, points, Icon }, i (flag)}
			{@const pid = `${companyId}-${config.idPrefix}${i}`}
			<div class="flex flex-col gap-2 rounded-xl border {config.borderColor} p-4">
				<div class="flex flex-wrap items-center gap-2">
					{#if Icon}<Icon size={16} />{/if}
					<span class="text-sm font-medium">{category?.name ?? flag.category}</span>
					<span class="rounded-full px-2 py-0.5 text-xs {SEVERITY_COLOR[flag.severity] ?? ''}">
						{flag.severity}
					</span>
					{#if flag.status === 'sourced'}
						<span class="text-xs text-green-600 dark:text-green-400">✓ Sourced</span>
					{:else}
						<span class="text-xs text-gray-400 dark:text-zinc-400">○ Unverified</span>
					{/if}
					<span class="ml-auto flex items-center gap-1.5">
						<span class="font-mono text-xs {config.pointsColor}"
							>{config.sign}{points.toFixed(1)} pts</span
						>
						<button
							popovertarget={pid}
							class="-m-2.5 p-2.5 text-xs text-gray-300 hover:text-gray-500 dark:text-zinc-500 dark:hover:text-zinc-300"
							aria-label="Scoring details">ⓘ</button
						>
					</span>
				</div>
				<p class="text-sm text-gray-700 dark:text-zinc-300">{flag.description}</p>
				{#if flag.sourceUrl}
					<a
						href={flag.sourceUrl}
						target="_blank"
						rel="noreferrer external"
						class="text-xs break-all text-blue-600 hover:underline dark:text-blue-400"
						>{flag.sourceUrl}</a
					>
				{/if}
				{#if flag.dateAdded}
					<span class="text-xs text-gray-400 dark:text-zinc-400">Added {flag.dateAdded}</span>
				{/if}

				<!-- Popover shell (transparent, anchor-positioned) wraps the visible card -->
				<div
					id={pid}
					popover
					ontoggle={positionPopover}
					style="border:none;padding:0;background:transparent;margin:0;overflow:visible;"
				>
					<div
						class="w-64 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
					>
						<p class="mb-3 text-xs font-medium text-gray-700 dark:text-zinc-300">
							How {config.sign}{points.toFixed(1)} pts was scored
						</p>
						<div class="flex flex-col gap-1.5 text-xs">
							<div class="flex justify-between gap-6 text-gray-500 dark:text-zinc-300">
								<span>Category weight</span>
								<span class="font-mono">×{category?.defaultWeight ?? 1}</span>
							</div>
							<div class="flex justify-between gap-6 text-gray-500 dark:text-zinc-300">
								<span>Severity ({flag.severity})</span>
								<span class="font-mono">×{SEVERITY_MULTIPLIER[flag.severity] ?? 1}</span>
							</div>
							<div class="flex justify-between gap-6 text-gray-500 dark:text-zinc-300">
								<span>Confidence ({flag.status})</span>
								<span class="font-mono">×{CONFIDENCE_LABEL[flag.status] ?? '1.0'}</span>
							</div>
							<div
								class="mt-1 flex justify-between gap-6 border-t border-gray-100 pt-1.5 font-medium text-gray-700 dark:border-zinc-700 dark:text-zinc-300"
							>
								<span>Raw contribution</span>
								<span class="font-mono">{points.toFixed(1)} pts</span>
							</div>
						</div>
						<a
							href={resolve('/scoring')}
							class="mt-3 block text-xs text-blue-600 hover:underline dark:text-blue-400"
						>
							Learn more about how we score →
						</a>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
