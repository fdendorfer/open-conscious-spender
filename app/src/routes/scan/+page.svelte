<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { startBarcodeScan, CameraUnavailableError, type ScanHandle } from '$lib/barcodeScanner';
	import { loadDataset, ownershipChain, type Dataset, type Company } from '$lib/dataset';
	import { lookupBarcode, type LookupResult } from '$lib/lookup';
	import { scoreCompany, type Severity } from '$lib/scoring';
	import {
		saveDraft,
		submitDraft,
		submissionsRemainingToday,
		RateLimitedError,
		SubmissionFailedError,
		type Draft
	} from '$lib/contribute';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';

	type Phase =
		'loading' | 'idle' | 'scanning' | 'looking-up' | 'result' | 'contribute' | 'submitted';

	let phase = $state<Phase>('loading');
	let dataset = $state<Dataset | null>(null);
	let videoEl = $state<HTMLVideoElement | undefined>(undefined);
	let scanHandle: ScanHandle | null = null;
	let cameraError = $state<string | null>(null);
	let manualBarcode = $state('');
	let lookupResult = $state<LookupResult | null>(null);

	let contributeName = $state('');
	let contributeCategory = $state('');
	let contributeDescription = $state('');
	let contributeSeverity = $state<Severity>('moderate');
	let contributeSourceUrl = $state('');
	let contributeError = $state<string | null>(null);
	let submittedPrUrl = $state<string | null>(null);
	let lastDraft: Draft | null = null;

	onMount(async () => {
		dataset = await loadDataset();
		phase = 'idle';
	});

	onDestroy(() => scanHandle?.stop());

	async function startScan() {
		if (!videoEl) return;
		cameraError = null;
		phase = 'scanning';
		try {
			scanHandle = await startBarcodeScan(videoEl, onBarcodeDetected);
		} catch (err) {
			cameraError =
				err instanceof CameraUnavailableError
					? 'Camera unavailable — enter the barcode manually below.'
					: 'Something went wrong starting the camera.';
			phase = 'idle';
		}
	}

	async function onBarcodeDetected(raw: string) {
		scanHandle?.stop();
		scanHandle = null;
		await runLookup(raw);
	}

	async function submitManualBarcode() {
		if (!manualBarcode.trim()) return;
		await runLookup(manualBarcode.trim());
	}

	async function runLookup(gtin: string) {
		if (!dataset) return;
		phase = 'looking-up';
		lookupResult = await lookupBarcode(dataset, gtin);
		if (lookupResult.status === 'unknown-brand') {
			contributeName = lookupResult.brand;
		}
		phase = 'result';
	}

	function scoreFor(company: Company) {
		return dataset
			? scoreCompany(company.flags, dataset.categories)
			: { score: 0, band: 'green' as const };
	}

	function startOver() {
		phase = 'idle';
		lookupResult = null;
		manualBarcode = '';
		submittedPrUrl = null;
		contributeError = null;
	}

	function startContribute() {
		contributeCategory = dataset?.categories[0]?.id ?? '';
		phase = 'contribute';
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
			lastDraft = await saveDraft('company', payload);
			submittedPrUrl = await submitDraft(lastDraft);
			phase = 'submitted';
		} catch (err) {
			contributeError =
				err instanceof RateLimitedError || err instanceof SubmissionFailedError
					? err.message
					: 'Something went wrong submitting your contribution.';
		}
	}
</script>

<main class="mx-auto flex min-h-screen max-w-sm flex-col gap-6 p-6">
	<h1 class="text-lg font-medium">Scan a product</h1>

	{#if phase === 'loading'}
		<p class="text-sm text-gray-500">Loading dataset…</p>
	{/if}

	{#if phase === 'idle' || phase === 'scanning'}
		<div class="overflow-hidden rounded-2xl bg-black">
			<video bind:this={videoEl} class="aspect-square w-full object-cover" muted playsinline
			></video>
		</div>

		{#if phase === 'idle'}
			<button class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white" onclick={startScan}>
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
			<button class="rounded-xl bg-gray-200 px-4 py-2" onclick={submitManualBarcode}>Look up</button
			>
		</div>
	{/if}

	{#if phase === 'looking-up'}
		<p class="text-sm text-gray-500">Looking up…</p>
	{/if}

	{#if phase === 'result' && lookupResult}
		{#if lookupResult.status === 'found'}
			{@const { score, band } = scoreFor(lookupResult.company)}
			{@const chain = ownershipChain(dataset!, lookupResult.company)}
			<div
				class="flex flex-col items-center gap-4 rounded-2xl p-8"
				class:bg-green-100={band === 'green'}
				class:bg-yellow-100={band === 'yellow'}
				class:bg-red-100={band === 'red'}
			>
				<span class="text-center font-medium">
					{chain.map((c) => c.name).join(' → ')}
				</span>
				<div class="flex flex-wrap justify-center gap-4">
					{#each lookupResult.company.flags as flag (flag.category + flag.description)}
						{@const Icon =
							CATEGORY_ICONS[dataset!.categories.find((c) => c.id === flag.category)?.icon ?? '']}
						{#if Icon}
							<Icon size={40} weight={flag.status === 'sourced' ? 'fill' : 'regular'} />
						{/if}
					{/each}
				</div>
				<span class="text-3xl font-semibold">{score}</span>
			</div>
		{:else if lookupResult.status === 'unknown-brand'}
			<p class="text-sm text-gray-600">
				Found the product ("{lookupResult.productName ?? 'unknown name'}") but "{lookupResult.brand}"
				isn't in the database yet.
			</p>
			<button
				class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white"
				onclick={startContribute}
			>
				Add "{lookupResult.brand}"
			</button>
		{:else}
			<p class="text-sm text-gray-600">Couldn't find that product or its brand.</p>
			<button
				class="rounded-xl bg-gray-900 px-4 py-3 font-medium text-white"
				onclick={startContribute}
			>
				Add it manually
			</button>
		{/if}
		<button class="text-sm text-gray-500 underline" onclick={startOver}>Scan another</button>
	{/if}

	{#if phase === 'contribute'}
		<form class="flex flex-col gap-3" onsubmit={(e) => (e.preventDefault(), submitContribution())}>
			<label class="flex flex-col gap-1 text-sm">
				Company name
				<input class="rounded-xl border border-gray-300 px-3 py-2" bind:value={contributeName} />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				Flag category
				<select class="rounded-xl border border-gray-300 px-3 py-2" bind:value={contributeCategory}>
					{#each dataset?.categories ?? [] as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				Severity
				<select class="rounded-xl border border-gray-300 px-3 py-2" bind:value={contributeSeverity}>
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
			Scan another
		</button>
	{/if}
</main>
