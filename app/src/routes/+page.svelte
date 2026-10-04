<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Barcode } from 'phosphor-svelte';
	import categoriesSeed from '../../../data/categories.json';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';
	import { loadDataset, type Dataset, type Company } from '$lib/dataset';
	import CompanySearch from '$lib/components/CompanySearch.svelte';
	import DatasetLoadError from '$lib/components/DatasetLoadError.svelte';
	import type { Severity } from '$lib/scoring';
	import {
		saveDraft,
		submitDraft,
		submissionsRemainingToday,
		requestBrand,
		requestsRemainingToday,
		RateLimitedError,
		SubmissionFailedError,
		type BrandRequestResult
	} from '$lib/contribute';
	import { pageTitle, SITE_FULL_NAME } from '$lib/seo';

	type Phase =
		| 'loading'
		| 'load-failed'
		| 'browsing'
		| 'looking-up'
		| 'request'
		| 'requested'
		| 'contribute'
		| 'submitted';

	let phase = $state<Phase>('loading');
	let dataset = $state<Dataset | null>(null);

	let searchQuery = $state('');

	let contributeName = $state('');
	let contributePolarity = $state<'negative' | 'positive'>('negative');
	let contributeCategory = $state('');
	let contributeDescription = $state('');
	let contributeSeverity = $state<Severity>('moderate');
	let contributeSourceUrl = $state('');
	let contributeError = $state<string | null>(null);
	let submittedPrUrl = $state<string | null>(null);

	let requestGtin = $state<string | null>(null);
	let requestNote = $state('');
	let requestError = $state<string | null>(null);
	let requestResult = $state<BrandRequestResult | null>(null);

	onMount(async () => {
		await load();
	});

	async function load() {
		phase = 'loading';
		try {
			dataset = await loadDataset();
		} catch {
			phase = 'load-failed';
			return;
		}
		phase = 'browsing';
	}

	// The scanner and the nav bar search both hand off an unrated brand as
	// ?add=<brand>&gtin=<scanned>. An effect rather than onMount, because either
	// can fire while this page is already the open one.
	let pendingAdd = $derived(page.url.searchParams.get('add'));
	$effect(() => {
		const name = pendingAdd;
		if (!name) return;
		untrack(() => {
			requestGtin = page.url.searchParams.get('gtin');
			addByName(name);
		});
	});

	function goToCompany(company: Company) {
		goto(resolve('/brand/[slug]', { slug: company.id }));
	}

	function addByName(name: string) {
		contributeName = name;
		phase = 'request';
	}

	function startOver() {
		// Drop the hand-off params, so asking for the same brand again re-opens the
		// form. A goto() rather than replaceState(), which leaves page.url stale.
		if (pendingAdd) void goto(resolve('/'), { replaceState: true, noScroll: true });
		phase = 'browsing';
		searchQuery = '';
		submittedPrUrl = null;
		contributeError = null;
		requestNote = '';
		requestError = null;
		requestResult = null;
		requestGtin = null;
	}

	async function sendRequest() {
		requestError = null;
		if (!contributeName.trim()) {
			requestError = 'A brand name is required.';
			return;
		}
		try {
			requestResult = await requestBrand(contributeName.trim(), requestGtin, requestNote);
			phase = 'requested';
		} catch (err) {
			requestError =
				err instanceof RateLimitedError || err instanceof SubmissionFailedError
					? err.message
					: 'Something went wrong sending your request.';
		}
	}

	async function submitContribution() {
		contributeError = null;
		if (!contributeName.trim() || !contributeCategory || !contributeDescription.trim()) {
			contributeError = 'Name, category, and description are required.';
			return;
		}
		const payload = {
			name: contributeName.trim(),
			flags: [
				{
					polarity: contributePolarity,
					category: contributeCategory,
					description: contributeDescription.trim(),
					severity: contributeSeverity,
					sourceUrl: contributeSourceUrl.trim() || null
				}
			]
		};
		try {
			const draft = await saveDraft('company', payload);
			submittedPrUrl = await submitDraft(draft);
			phase = 'submitted';
		} catch (err) {
			contributeError =
				err instanceof RateLimitedError || err instanceof SubmissionFailedError
					? err.message
					: 'Something went wrong submitting your contribution.';
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Ethical shopping lookups')}</title>
</svelte:head>

<main class="mx-auto flex max-w-sm flex-col gap-10 p-6 sm:max-w-xl lg:max-w-4xl">
	<div class="flex flex-col items-center gap-4 pt-8 text-center">
		<h1 class="text-2xl font-semibold sm:text-3xl">{SITE_FULL_NAME}</h1>
		<p class="max-w-md text-gray-600 dark:text-zinc-300">
			Search a company (or scan its barcode). See its red flags at a glance. Decide in seconds —
			before you're stuck reading in the aisle.
		</p>
	</div>

	<div class="mx-auto flex w-full max-w-md flex-col gap-3">
		{#if phase === 'loading'}
			<p class="text-center text-sm text-gray-500 dark:text-zinc-300">Loading dataset…</p>
		{/if}

		{#if phase === 'load-failed'}
			<DatasetLoadError onRetry={load} />
		{/if}

		{#if phase === 'browsing'}
			<CompanySearch
				{dataset}
				bind:query={searchQuery}
				onSelect={goToCompany}
				onEnterNoResults={addByName}
			>
				{#snippet emptyState(query)}
					<div class="flex flex-col gap-2 p-3">
						<p class="text-sm text-gray-600 dark:text-zinc-300">No match for "{query}".</p>
						<button
							class="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
							onclick={() => addByName(query)}
						>
							Request a rating for "{query}"
						</button>
					</div>
				{/snippet}
			</CompanySearch>

			<a
				class="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 transition-colors hover:border-gray-400 dark:border-zinc-700 dark:hover:border-zinc-600"
				href={resolve('/shopping')}
			>
				<span
					class="shrink-0 rounded-xl bg-gray-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
				>
					<Barcode size={22} />
				</span>
				<span class="flex flex-col gap-0.5">
					<span class="text-sm font-medium text-gray-900 dark:text-zinc-100"
						>Already in the shop?</span
					>
					<span class="text-sm text-gray-600 dark:text-zinc-300">
						Shopping mode makes the camera your search bar — scan a barcode, glance, move on.
					</span>
				</span>
			</a>
		{/if}

		{#if phase === 'looking-up'}
			<p class="text-center text-sm text-gray-500 dark:text-zinc-300">Looking up…</p>
		{/if}

		{#if phase === 'request'}
			<form class="flex flex-col gap-3" onsubmit={(e) => (e.preventDefault(), sendRequest())}>
				<div>
					<h2 class="text-lg font-semibold">Not rated yet</h2>
					<p class="mt-1 text-sm text-gray-600 dark:text-zinc-300">
						Ask for this brand to be looked into. No research needed — a maintainer does the
						sourcing. The more people ask, the sooner it gets picked up.
					</p>
				</div>
				<label class="flex flex-col gap-1 text-sm">
					Brand or company name
					<input
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={contributeName}
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Anything worth knowing? (optional)
					<textarea
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						rows="2"
						placeholder="Where you saw it, who you think owns it…"
						bind:value={requestNote}></textarea>
				</label>

				<p class="text-xs text-gray-500 dark:text-zinc-300">
					{requestsRemainingToday()} requests left today on this device.
				</p>
				{#if requestError}
					<p class="text-sm text-red-600 dark:text-red-400">{requestError}</p>
				{/if}
				<button
					class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
					type="submit"
				>
					Request a rating
				</button>
				<div
					class="mt-1 flex flex-col items-center gap-1 border-t border-gray-200 pt-3 dark:border-zinc-700"
				>
					<button
						class="px-2 py-2 text-sm text-gray-500 underline dark:text-zinc-300"
						type="button"
						onclick={() => (phase = 'contribute')}
					>
						I already have a source — add the details myself
					</button>
					<button
						class="px-2 py-2 text-sm text-gray-500 underline dark:text-zinc-300"
						type="button"
						onclick={startOver}
					>
						Cancel
					</button>
				</div>
			</form>
		{/if}

		{#if phase === 'requested' && requestResult}
			<div class="flex flex-col gap-3">
				<p class="text-sm text-gray-600 dark:text-zinc-300">
					Thanks — <strong>{contributeName}</strong> is on the list.
					{#if requestResult.requestCount > 1}
						It's been requested {requestResult.requestCount} times now, which moves it up the queue.
					{/if}
				</p>
				<a
					class="text-sm underline"
					href={requestResult.issueUrl}
					target="_blank"
					rel="noreferrer external">Follow it on GitHub</a
				>
				<button
					class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
					onclick={startOver}
				>
					Search something else
				</button>
			</div>
		{/if}

		{#if phase === 'contribute'}
			<form
				class="flex flex-col gap-3"
				onsubmit={(e) => (e.preventDefault(), submitContribution())}
			>
				<label class="flex flex-col gap-1 text-sm">
					Company name
					<input
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={contributeName}
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Flag type
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={contributePolarity}
					>
						<option value="negative">Red flag (concern)</option>
						<option value="positive">Green flag (positive)</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Flag category
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={contributeCategory}
					>
						{#each dataset?.categories ?? [] as category (category.id)}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Severity
					<select
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={contributeSeverity}
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
						bind:value={contributeDescription}></textarea>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Source URL (optional, but helps it get verified faster)
					<input
						class="rounded-xl border border-gray-300 px-3 py-2 dark:border-zinc-600"
						bind:value={contributeSourceUrl}
					/>
				</label>

				<p class="text-xs text-gray-500 dark:text-zinc-300">
					{submissionsRemainingToday()} submissions left today on this device.
				</p>
				{#if contributeError}
					<p class="text-sm text-red-600 dark:text-red-400">{contributeError}</p>
				{/if}
				<button
					class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
					type="submit"
				>
					Submit as a pull request
				</button>
				<button
					class="text-sm text-gray-500 underline dark:text-zinc-300"
					type="button"
					onclick={startOver}
				>
					Cancel
				</button>
			</form>
		{/if}

		{#if phase === 'submitted'}
			<p class="text-sm text-gray-600 dark:text-zinc-300">
				Thanks! Your contribution is up for maintainer review:
				<a class="underline" href={submittedPrUrl} target="_blank" rel="noreferrer external"
					>{submittedPrUrl}</a
				>
			</p>
			<button
				class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
				onclick={startOver}
			>
				Search again
			</button>
		{/if}
	</div>

	<div class="grid gap-8 lg:grid-cols-2">
		<section id="how-it-works" class="flex flex-col gap-3">
			<h2 class="font-medium">How it works</h2>
			<ol class="flex flex-col gap-2 text-sm text-gray-600 dark:text-zinc-300">
				<li>1. Search a company by name — or turn on shopping mode and scan its barcode.</li>
				<li>2. See flag icons and a score — no reading required to make a call.</li>
				<li>
					3. Missing something? Request it in one tap — the most-asked-for brands get rated first.
				</li>
			</ol>
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="font-medium">What we track</h2>
			<p class="text-sm text-gray-600 dark:text-zinc-300">
				Every flag falls into one of these categories, each weighted differently in the score:
			</p>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each categoriesSeed as category (category.id)}
					{@const Icon = CATEGORY_ICONS[category.icon]}
					<li
						class="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-zinc-700"
					>
						{#if Icon}
							<Icon size={24} />
						{/if}
						{category.name}
					</li>
				{/each}
			</ul>
		</section>
	</div>

	<section id="about" class="flex flex-col gap-2 pb-8">
		<h2 class="font-medium">Open and community-maintained</h2>
		<p class="text-sm text-gray-600 dark:text-zinc-300">
			Anyone can add a company or a flag — no account needed. The full dataset is public and openly
			licensed (CC BY 4.0); every change is a reviewable pull request on
			<a
				class="underline"
				href="https://github.com/fdendorfer/open-conscious-spender"
				target="_blank"
				rel="noreferrer external">GitHub</a
			>.
		</p>
	</section>
</main>
