<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { loadDataset, findCompanyById, type Dataset } from '$lib/dataset';
	import {
		saveDraft,
		submitDraft,
		submissionsRemainingToday,
		reportInaccuracy,
		requestsRemainingToday
	} from '$lib/contribute';
	import type { Severity } from '$lib/scoring';
	import CompanyResult from '$lib/components/CompanyResult.svelte';
	import DatasetLoadError from '$lib/components/DatasetLoadError.svelte';
	import type { PageProps } from './$types';
	import { pageTitle } from '$lib/seo';

	let { params }: PageProps = $props();

	let dataset = $state<Dataset | null>(null);
	let loaded = $state(false);
	let loadFailed = $state(false);

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

	let showReportForm = $state(false);
	let reportNote = $state('');
	let reportError = $state<string | null>(null);
	let reportIssueUrl = $state<string | null>(null);

	let sending = $state(false);

	onMount(async () => {
		await load();
	});

	async function load() {
		loadFailed = false;
		try {
			dataset = await loadDataset();
			flagCategory = dataset.categories[0]?.id ?? '';
		} catch {
			loadFailed = true;
		}
		loaded = true;
	}

	// Never carry a half-filled suggestion over to the company the user just opened.
	$effect(() => {
		void params.slug;
		showFlagForm = false;
		flagDescription = '';
		flagSourceUrl = '';
		flagError = null;
		flagPrUrl = null;
		showReportForm = false;
		reportNote = '';
		reportError = null;
		reportIssueUrl = null;
	});

	/** Focuses the element that replaced the control the user just activated. */
	async function focusAfterSwap(id: string) {
		await tick();
		document.getElementById(id)?.focus();
	}

	async function submitReport() {
		if (sending) return;
		reportError = null;
		if (!company) return;
		if (!reportNote.trim()) {
			reportError = 'Tell us what looks wrong.';
			return;
		}
		sending = true;
		try {
			reportIssueUrl = await reportInaccuracy(company.id, reportNote);
			void focusAfterSwap('report-thanks');
		} catch (err) {
			reportError = err instanceof Error ? err.message : 'Something went wrong sending this.';
		} finally {
			sending = false;
		}
	}

	async function submitFlag() {
		if (sending) return;
		flagError = null;
		if (!dataset || !company) return;
		if (!flagCategory || !flagDescription.trim()) {
			flagError = 'Category and description are required.';
			return;
		}
		sending = true;
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
			void focusAfterSwap('flag-thanks');
		} catch (err) {
			flagError = err instanceof Error ? err.message : 'Something went wrong submitting this.';
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle(company?.name ?? 'Company')}</title>
</svelte:head>

<main id="main" tabindex="-1" class="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10 outline-none">
	{#if !loaded}
		<p class="text-sm text-gray-500 dark:text-zinc-300" role="status">Loading…</p>
	{:else if loadFailed}
		<DatasetLoadError onRetry={load} />
	{:else if !company || !dataset}
		<h1 class="text-sm font-normal text-gray-600 dark:text-zinc-300">
			No company found for "{params.slug}".
		</h1>
		<a
			class="rounded-xl bg-primary px-4 py-3 text-center font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
			href={resolve('/')}
		>
			Search instead
		</a>
	{:else}
		<CompanyResult {company} {dataset} />

		{#if !showFlagForm && !flagPrUrl && !showReportForm && !reportIssueUrl}
			<div class="flex flex-col items-start gap-2">
				<button
					class="text-sm text-gray-500 underline dark:text-zinc-300"
					onclick={() => ((showFlagForm = true), void focusAfterSwap('flag-polarity'))}
				>
					Something we missed? Suggest a flag
				</button>
				<button
					class="text-sm text-gray-500 underline dark:text-zinc-300"
					onclick={() => ((showReportForm = true), void focusAfterSwap('report-form'))}
				>
					Something here looks wrong? Report it
				</button>
			</div>
		{/if}

		{#if showReportForm && !reportIssueUrl}
			<form
				id="report-form"
				tabindex="-1"
				aria-label="Report an inaccuracy"
				aria-busy={sending}
				class="flex flex-col gap-3"
				onsubmit={(e) => (e.preventDefault(), submitReport())}
			>
				<label class="flex flex-col gap-1 text-sm">
					<span
						>What's inaccurate? <span aria-hidden="true" class="text-red-700 dark:text-red-400"
							>*</span
						></span
					>
					<textarea
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						rows="4"
						placeholder="Wrong owner, outdated flag, severity looks off…"
						aria-required="true"
						aria-invalid={reportError && !reportNote.trim() ? 'true' : undefined}
						aria-describedby={reportError ? 'report-error' : undefined}
						bind:value={reportNote}></textarea>
				</label>
				<p class="text-xs text-gray-500 dark:text-zinc-300">
					<span aria-hidden="true">*</span> Required
				</p>
				<p class="text-xs text-gray-500 dark:text-zinc-300">
					{requestsRemainingToday()} reports left today on this device.
				</p>
				{#if reportError}
					<p id="report-error" role="alert" class="text-sm text-red-600 dark:text-red-400">
						{reportError}
					</p>
				{/if}
				<button
					class="rounded-xl bg-primary px-4 py-3 font-medium text-white aria-disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
					type="submit"
					aria-disabled={sending}
				>
					{sending ? 'Sending…' : 'Send report'}
				</button>
			</form>
		{/if}

		{#if reportIssueUrl}
			<p id="report-thanks" tabindex="-1" class="text-sm text-gray-600 dark:text-zinc-300">
				Thanks — a maintainer will take a look:
				<a class="underline" href={reportIssueUrl} target="_blank" rel="noreferrer external"
					>{reportIssueUrl}</a
				>
			</p>
		{/if}

		{#if showFlagForm && !flagPrUrl}
			<form
				class="flex flex-col gap-3"
				aria-busy={sending}
				onsubmit={(e) => (e.preventDefault(), submitFlag())}
			>
				<label class="flex flex-col gap-1 text-sm">
					Flag type
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						id="flag-polarity"
						bind:value={flagPolarity}
					>
						<option value="negative">Red flag (concern)</option>
						<option value="positive">Green flag (positive)</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span
						>Flag category <span aria-hidden="true" class="text-red-700 dark:text-red-400">*</span
						></span
					>
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						aria-required="true"
						aria-invalid={flagError && !flagCategory ? 'true' : undefined}
						aria-describedby={flagError ? 'flag-error' : undefined}
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
					<span
						>Description <span aria-hidden="true" class="text-red-700 dark:text-red-400">*</span
						></span
					>
					<textarea
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						aria-required="true"
						aria-invalid={flagError && !flagDescription.trim() ? 'true' : undefined}
						aria-describedby={flagError ? 'flag-error' : undefined}
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
					<span aria-hidden="true">*</span> Required
				</p>
				<p class="text-xs text-gray-500 dark:text-zinc-300">
					{submissionsRemainingToday()} submissions left today on this device.
				</p>
				{#if flagError}
					<p id="flag-error" role="alert" class="text-sm text-red-600 dark:text-red-400">
						{flagError}
					</p>
				{/if}
				<button
					class="rounded-xl bg-primary px-4 py-3 font-medium text-white aria-disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
					type="submit"
					aria-disabled={sending}
				>
					{sending ? 'Sending…' : 'Submit as a pull request'}
				</button>
			</form>
		{/if}

		{#if flagPrUrl}
			<p id="flag-thanks" tabindex="-1" class="text-sm text-gray-600 dark:text-zinc-300">
				Thanks! Up for maintainer review:
				<a class="underline" href={flagPrUrl} target="_blank" rel="noreferrer external"
					>{flagPrUrl}</a
				>
			</p>
		{/if}
	{/if}
</main>
