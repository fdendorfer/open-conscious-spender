<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadDataset, findCompanyById, type Dataset } from '$lib/dataset';
	import { saveDraft, submitDraft, submissionsRemainingToday } from '$lib/contribute';
	import type { Severity } from '$lib/scoring';
	import CompanyResult from '$lib/components/CompanyResult.svelte';
	import type { PageProps } from './$types';
	import { pageTitle } from '$lib/seo';

	let { params }: PageProps = $props();

	let dataset = $state<Dataset | null>(null);
	let loaded = $state(false);

	// Derived, not assigned once on mount: SvelteKit reuses this component when
	// navigating from one brand page to another, so only the params change.
	let company = $derived(dataset ? findCompanyById(dataset, params.slug) : undefined);

	let showFlagForm = $state(false);
	let flagPolarity = $state<'negative' | 'positive'>('negative');
	let flagCategory = $state('');
	let flagDescription = $state('');
	let flagSeverity = $state<Severity>('moderate');
	let flagSourceUrl = $state('');
	let flagError = $state<string | null>(null);
	let flagPrUrl = $state<string | null>(null);

	onMount(async () => {
		dataset = await loadDataset();
		flagCategory = dataset.categories[0]?.id ?? '';
		loaded = true;
	});

	// Never carry a half-filled suggestion over to the company the user just opened.
	$effect(() => {
		void params.slug;
		showFlagForm = false;
		flagDescription = '';
		flagSourceUrl = '';
		flagError = null;
		flagPrUrl = null;
	});

	async function submitFlag() {
		flagError = null;
		if (!dataset || !company) return;
		if (!flagCategory || !flagDescription.trim()) {
			flagError = 'Category and description are required.';
			return;
		}
		try {
			const draft = await saveDraft('flag', {
				companyId: company.id,
				flag: {
					polarity: flagPolarity,
					category: flagCategory,
					description: flagDescription.trim(),
					severity: flagSeverity,
					sourceUrl: flagSourceUrl.trim() || null
				}
			});
			flagPrUrl = await submitDraft(draft);
		} catch (err) {
			flagError = err instanceof Error ? err.message : 'Something went wrong submitting this.';
		}
	}
</script>

<svelte:head>
	<title>{pageTitle(company?.name ?? 'Company')}</title>
</svelte:head>

<main class="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
	{#if !loaded}
		<p class="text-sm text-gray-500 dark:text-zinc-300">Loading…</p>
	{:else if !company || !dataset}
		<p class="text-sm text-gray-600 dark:text-zinc-300">
			No company found for "{params.slug}".
		</p>
		<a
			class="rounded-xl bg-gray-900 px-4 py-3 text-center font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
			href={resolve('/')}
		>
			Search instead
		</a>
	{:else}
		<CompanyResult {company} {dataset} />

		{#if !showFlagForm && !flagPrUrl}
			<button
				class="text-sm text-gray-500 underline dark:text-zinc-300"
				onclick={() => (showFlagForm = true)}
			>
				Something we missed? Suggest a flag
			</button>
		{/if}

		{#if showFlagForm && !flagPrUrl}
			<form class="flex flex-col gap-3" onsubmit={(e) => (e.preventDefault(), submitFlag())}>
				<label class="flex flex-col gap-1 text-sm">
					Flag type
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={flagPolarity}
					>
						<option value="negative">Red flag (concern)</option>
						<option value="positive">Green flag (positive)</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Flag category
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={flagCategory}
					>
						{#each dataset.categories as category (category.id)}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Severity
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={flagSeverity}
					>
						<option value="minor">Minor</option>
						<option value="moderate">Moderate</option>
						<option value="severe">Severe</option>
						<option value="systemic">Systemic</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Description
					<textarea
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={flagDescription}></textarea>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Source URL (optional)
					<input
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={flagSourceUrl}
					/>
				</label>
				<p class="text-xs text-gray-500 dark:text-zinc-300">
					{submissionsRemainingToday()} submissions left today on this device.
				</p>
				{#if flagError}
					<p class="text-sm text-red-600 dark:text-red-400">{flagError}</p>
				{/if}
				<button
					class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
					type="submit"
				>
					Submit as a pull request
				</button>
			</form>
		{/if}

		{#if flagPrUrl}
			<p class="text-sm text-gray-600 dark:text-zinc-300">
				Thanks! Up for maintainer review:
				<a class="underline" href={flagPrUrl} target="_blank" rel="noreferrer external"
					>{flagPrUrl}</a
				>
			</p>
		{/if}
	{/if}
</main>
