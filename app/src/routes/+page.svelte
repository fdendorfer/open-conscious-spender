<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import categoriesSeed from '../../../data/categories.json';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';
	import { startBarcodeScan, CameraUnavailableError, type ScanHandle } from '$lib/barcodeScanner';
	import { loadDataset, searchCompaniesByName, type Dataset, type Company } from '$lib/dataset';
	import { lookupBarcode } from '$lib/lookup';
	import { scoreCompany, type Severity } from '$lib/scoring';
	import {
		saveDraft,
		submitDraft,
		submissionsRemainingToday,
		RateLimitedError,
		SubmissionFailedError
	} from '$lib/contribute';

	type Phase = 'loading' | 'browsing' | 'looking-up' | 'contribute' | 'submitted';

	let phase = $state<Phase>('loading');
	let dataset = $state<Dataset | null>(null);

	let searchQuery = $state('');
	let searchResults = $derived(dataset ? searchCompaniesByName(dataset, searchQuery) : []);
	let activeIndex = $state(-1);

	let showScanner = $state(false);
	let videoEl = $state<HTMLVideoElement | undefined>(undefined);
	let scanning = $state(false);
	let scanHandle: ScanHandle | null = null;
	let cameraError = $state<string | null>(null);
	let manualBarcode = $state('');

	let contributeName = $state('');
	let contributeCategory = $state('');
	let contributeDescription = $state('');
	let contributeSeverity = $state<Severity>('moderate');
	let contributeSourceUrl = $state('');
	let contributeError = $state<string | null>(null);
	let submittedPrUrl = $state<string | null>(null);

	onMount(async () => {
		dataset = await loadDataset();
		phase = 'browsing';
	});

	onDestroy(() => scanHandle?.stop());

	function rowBand(company: Company) {
		return dataset ? scoreCompany(company.flags, dataset.categories).band : 'green';
	}

	function goToCompany(company: Company) {
		goto(resolve('/brand/[slug]', { slug: company.id }));
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, searchResults.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, -1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (activeIndex >= 0 && searchResults[activeIndex]) goToCompany(searchResults[activeIndex]);
			else if (searchResults.length === 1) goToCompany(searchResults[0]);
			else if (searchResults.length === 0 && searchQuery.trim().length >= 2) addByName();
		} else if (e.key === 'Escape') {
			searchQuery = '';
			activeIndex = -1;
		}
	}

	function addByName() {
		contributeName = searchQuery.trim();
		phase = 'contribute';
	}

	async function startScan() {
		if (!videoEl) return;
		cameraError = null;
		scanning = true;
		try {
			scanHandle = await startBarcodeScan(videoEl, onBarcodeDetected);
		} catch (err) {
			cameraError =
				err instanceof CameraUnavailableError
					? 'Camera unavailable — try the manual barcode field below, or search by name instead.'
					: 'Something went wrong starting the camera.';
			scanning = false;
		}
	}

	async function onBarcodeDetected(raw: string) {
		scanHandle?.stop();
		scanHandle = null;
		scanning = false;
		await runBarcodeLookup(raw);
	}

	async function submitManualBarcode() {
		if (!manualBarcode.trim()) return;
		await runBarcodeLookup(manualBarcode.trim());
	}

	async function runBarcodeLookup(gtin: string) {
		if (!dataset) return;
		phase = 'looking-up';
		const result = await lookupBarcode(dataset, gtin);
		if (result.status === 'found') {
			goToCompany(result.company);
			return;
		}
		contributeName = result.status === 'unknown-brand' ? result.brand : '';
		phase = 'contribute';
	}

	function startOver() {
		phase = 'browsing';
		searchQuery = '';
		manualBarcode = '';
		showScanner = false;
		submittedPrUrl = null;
		contributeError = null;
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

<main class="mx-auto flex max-w-sm flex-col gap-10 p-6 sm:max-w-xl lg:max-w-4xl">
	<div class="flex flex-col items-center gap-4 pt-8 text-center">
		<h1 class="text-2xl font-semibold sm:text-3xl">Open Conscious Spender</h1>
		<p class="max-w-md text-gray-600">
			Search a company (or scan its barcode). See its red flags at a glance. Decide in seconds —
			before you're stuck reading in the aisle.
		</p>
	</div>

	<div class="mx-auto flex w-full max-w-md flex-col gap-3">
		{#if phase === 'loading'}
			<p class="text-center text-sm text-gray-500">Loading dataset…</p>
		{/if}

		{#if phase === 'browsing'}
			<div class="relative">
				<input
					class="w-full rounded-xl border border-gray-300 px-3 py-2"
					placeholder="Search company name…"
					bind:value={searchQuery}
					oninput={() => (activeIndex = -1)}
					onkeydown={onSearchKeydown}
				/>

				{#if searchQuery.trim().length >= 2}
					<div
						class="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg"
					>
						{#if searchResults.length > 0}
							<ul>
								{#each searchResults as company, i (company.id)}
									<li>
										<button
											class="flex w-full items-center gap-2 px-3 py-2 text-left first:rounded-t-xl last:rounded-b-xl"
											class:bg-gray-100={i === activeIndex}
											onclick={() => goToCompany(company)}
											onmouseenter={() => (activeIndex = i)}
										>
											<span
												class="h-2 w-2 shrink-0 rounded-full"
												class:bg-green-500={rowBand(company) === 'green'}
												class:bg-yellow-500={rowBand(company) === 'yellow'}
												class:bg-red-500={rowBand(company) === 'red'}
											></span>
											{company.name}
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							<div class="flex flex-col gap-2 p-3">
								<p class="text-sm text-gray-600">No match for "{searchQuery}".</p>
								<button
									class="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
									onclick={addByName}
								>
									Add "{searchQuery}"
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<button class="text-sm text-gray-500 underline" onclick={() => (showScanner = !showScanner)}>
				{showScanner ? 'Hide barcode scanner' : "Can't find it by name? Scan a barcode instead"}
			</button>

			{#if showScanner}
				<div class="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4">
					<div class="mx-auto w-full max-w-xs overflow-hidden rounded-2xl bg-black">
						<video bind:this={videoEl} class="aspect-square w-full object-cover" muted playsinline
						></video>
					</div>

					{#if !scanning}
						<button
							class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white"
							onclick={startScan}
						>
							Start camera scan
						</button>
					{/if}

					{#if cameraError}
						<p class="text-sm text-red-600">{cameraError}</p>
					{/if}

					<div class="flex gap-2">
						<input
							class="flex-1 rounded-xl border border-gray-300 px-3 py-2"
							placeholder="Or type a barcode…"
							bind:value={manualBarcode}
						/>
						<button class="rounded-xl bg-gray-200 px-4 py-2" onclick={submitManualBarcode}
							>Look up</button
						>
					</div>
				</div>
			{/if}
		{/if}

		{#if phase === 'looking-up'}
			<p class="text-center text-sm text-gray-500">Looking up…</p>
		{/if}

		{#if phase === 'contribute'}
			<form
				class="flex flex-col gap-3"
				onsubmit={(e) => (e.preventDefault(), submitContribution())}
			>
				<label class="flex flex-col gap-1 text-sm">
					Company name
					<input class="rounded-xl border border-gray-300 px-3 py-2" bind:value={contributeName} />
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Flag category
					<select
						class="rounded-xl border border-gray-300 px-3 py-2"
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
						class="rounded-xl border border-gray-300 px-3 py-2"
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
						class="rounded-xl border border-gray-300 px-3 py-2"
						bind:value={contributeDescription}></textarea>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Source URL (optional, but helps it get verified faster)
					<input
						class="rounded-xl border border-gray-300 px-3 py-2"
						bind:value={contributeSourceUrl}
					/>
				</label>

				<p class="text-xs text-gray-500">
					{submissionsRemainingToday()} submissions left today on this device.
				</p>
				{#if contributeError}
					<p class="text-sm text-red-600">{contributeError}</p>
				{/if}
				<button class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white" type="submit">
					Submit as a pull request
				</button>
				<button class="text-sm text-gray-500 underline" type="button" onclick={startOver}>
					Cancel
				</button>
			</form>
		{/if}

		{#if phase === 'submitted'}
			<p class="text-sm text-gray-600">
				Thanks! Your contribution is up for maintainer review:
				<a class="underline" href={submittedPrUrl} target="_blank" rel="noreferrer external"
					>{submittedPrUrl}</a
				>
			</p>
			<button class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white" onclick={startOver}>
				Search again
			</button>
		{/if}
	</div>

	<div class="grid gap-8 lg:grid-cols-2">
		<section class="flex flex-col gap-3">
			<h2 class="font-medium">How it works</h2>
			<ol class="flex flex-col gap-2 text-sm text-gray-600">
				<li>1. Search a company by name, or scan a barcode if you don't know it.</li>
				<li>2. See flag icons and a score — no reading required to make a call.</li>
				<li>
					3. Missing something? Add it — it goes straight into a public pull request for review.
				</li>
			</ol>
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="font-medium">What we track</h2>
			<p class="text-sm text-gray-600">
				Every flag falls into one of these categories, each weighted differently in the score:
			</p>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each categoriesSeed as category (category.id)}
					{@const Icon = CATEGORY_ICONS[category.icon]}
					<li class="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm">
						{#if Icon}
							<Icon size={24} />
						{/if}
						{category.name}
					</li>
				{/each}
			</ul>
		</section>
	</div>

	<section class="flex flex-col gap-2 pb-8">
		<h2 class="font-medium">Open and community-maintained</h2>
		<p class="text-sm text-gray-600">
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
