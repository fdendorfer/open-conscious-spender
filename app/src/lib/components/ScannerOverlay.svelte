<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Barcode, Keyboard, MagnifyingGlass, X } from 'phosphor-svelte';
	import { startBarcodeScan, CameraUnavailableError, type ScanHandle } from '$lib/barcodeScanner';
	import { loadDataset, type Dataset, type Company } from '$lib/dataset';
	import { lookupBarcode } from '$lib/lookup';
	import { shoppingMode } from '$lib/shoppingMode.svelte';
	import ScanResultSheet from './ScanResultSheet.svelte';

	let {
		onClose,
		onSearchByName
	}: {
		onClose: () => void;
		onSearchByName: () => void;
	} = $props();

	type Phase = 'starting' | 'scanning' | 'looking-up' | 'found' | 'miss' | 'camera-error';

	let phase = $state<Phase>('starting');
	let videoEl = $state<HTMLVideoElement | undefined>(undefined);
	let scanHandle: ScanHandle | null = null;
	let dataset = $state<Dataset | null>(null);

	let result = $state<Company | null>(null);
	let missBrand = $state<string | null>(null);
	let missGtin = $state<string | null>(null);
	let cameraError = $state<string | null>(null);

	let showManual = $state(false);
	let manualBarcode = $state('');

	onMount(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		void loadDataset().then((d) => (dataset = d));
		void startCamera();

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	onDestroy(() => {
		scanHandle?.stop();
		scanHandle = null;
	});

	// Leaving the page (e.g. "View full details") must not leave the camera running.
	beforeNavigate(() => onClose());

	async function startCamera() {
		if (!videoEl) return;
		cameraError = null;
		phase = 'starting';
		try {
			scanHandle = await startBarcodeScan(videoEl, onBarcodeDetected);
			phase = 'scanning';
		} catch (err) {
			cameraError =
				err instanceof CameraUnavailableError
					? 'No camera access. Type the barcode below, or search by name instead.'
					: 'Something went wrong starting the camera.';
			phase = 'camera-error';
			showManual = true;
		}
	}

	function onBarcodeDetected(raw: string) {
		void runLookup(raw);
	}

	async function submitManualBarcode() {
		const gtin = manualBarcode.trim();
		if (gtin) await runLookup(gtin);
	}

	async function runLookup(gtin: string) {
		phase = 'looking-up';
		const d = dataset ?? (await loadDataset());
		dataset = d;

		const lookup = await lookupBarcode(d, gtin);
		if (lookup.status === 'found') {
			showFound(lookup.company);
			return;
		}
		missBrand = lookup.status === 'unknown-brand' ? lookup.brand : null;
		missGtin = gtin;
		phase = 'miss';
	}

	// Single decision point for a resolved scan — swap this for a goto() to the
	// brand page if the in-overlay sheet ever proves worse in practice.
	function showFound(company: Company) {
		result = company;
		phase = 'found';
	}

	function scanNext() {
		result = null;
		missBrand = null;
		missGtin = null;
		manualBarcode = '';
		if (cameraError) {
			void startCamera();
			return;
		}
		phase = 'scanning';
		scanHandle?.resume();
	}

	function addMissingBrand() {
		const target = new URL(resolve('/'), location.origin);
		target.searchParams.set('add', missBrand ?? '');
		onClose();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() can't carry a query string
		goto(target);
	}

	function exitShoppingMode() {
		shoppingMode.disable();
		onClose();
	}

	let sheetOpen = $derived(phase === 'found' || phase === 'miss');
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onClose();
	}}
/>

<div class="fixed inset-0 z-[70] flex flex-col bg-gray-950 text-white">
	<header class="flex shrink-0 items-center gap-3 px-4 py-3">
		<span class="flex items-center gap-2 text-sm font-medium">
			<Barcode size={20} />
			Shopping mode
		</span>
		<button
			class="ml-auto cursor-pointer rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
			aria-label="Close camera"
			onclick={onClose}
		>
			<X size={22} />
		</button>
	</header>

	<div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
		<video
			bind:this={videoEl}
			class="absolute inset-0 h-full w-full object-cover"
			class:opacity-40={sheetOpen}
			muted
			playsinline
		></video>

		{#if !sheetOpen && !cameraError}
			<div class="pointer-events-none relative h-56 w-72 max-w-[80vw]">
				<div
					class="absolute top-0 left-0 h-8 w-8 rounded-tl-lg border-t-4 border-l-4 border-white"
				></div>
				<div
					class="absolute top-0 right-0 h-8 w-8 rounded-tr-lg border-t-4 border-r-4 border-white"
				></div>
				<div
					class="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-white"
				></div>
				<div
					class="absolute right-0 bottom-0 h-8 w-8 rounded-br-lg border-r-4 border-b-4 border-white"
				></div>
				{#if phase === 'scanning'}
					<div class="scanline absolute inset-x-3 h-0.5 rounded-full bg-red-500/80"></div>
				{/if}
			</div>
		{/if}

		{#if cameraError}
			<p class="relative max-w-xs px-6 text-center text-sm text-white/80">{cameraError}</p>
		{/if}
	</div>

	<div class="shrink-0">
		{#if sheetOpen}
			<div
				class="max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white text-gray-900 dark:bg-zinc-900 dark:text-zinc-100"
			>
				{#if phase === 'found' && result && dataset}
					<ScanResultSheet company={result} {dataset} onScanNext={scanNext} />
				{:else if phase === 'miss'}
					<div class="flex flex-col gap-4 p-5">
						{#if missBrand}
							<div>
								<h2 class="text-xl font-semibold">{missBrand}</h2>
								<p class="mt-1 text-sm text-gray-600 dark:text-zinc-300">
									We don't have this brand's owner in the dataset yet.
								</p>
							</div>
							<button
								class="cursor-pointer rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
								onclick={addMissingBrand}
							>
								Add "{missBrand}"
							</button>
						{:else}
							<div>
								<h2 class="text-xl font-semibold">No match</h2>
								<p class="mt-1 text-sm text-gray-600 dark:text-zinc-300">
									Nothing found for barcode {missGtin}. It may not be in Open Food Facts yet.
								</p>
							</div>
							<button
								class="cursor-pointer rounded-xl bg-gray-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
								onclick={onSearchByName}
							>
								Search by name instead
							</button>
						{/if}
						<button
							class="cursor-pointer rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
							onclick={scanNext}
						>
							Scan next item
						</button>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-3 px-4 pt-2 pb-5">
				<p class="text-center text-sm text-white/70">
					{#if phase === 'looking-up'}
						Looking up…
					{:else if phase === 'starting'}
						Starting camera…
					{:else if phase === 'scanning'}
						Point at a product barcode
					{:else}
						&nbsp;
					{/if}
				</p>

				{#if showManual}
					<div class="flex gap-2">
						<input
							class="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40"
							placeholder="Barcode number…"
							inputmode="numeric"
							bind:value={manualBarcode}
							onkeydown={(e) => e.key === 'Enter' && submitManualBarcode()}
						/>
						<button
							class="cursor-pointer rounded-xl bg-white px-4 py-2 font-medium text-gray-900"
							onclick={submitManualBarcode}
						>
							Look up
						</button>
					</div>
				{/if}

				<div class="flex items-center justify-center gap-2 text-sm">
					{#if !showManual}
						<button
							class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white"
							onclick={() => (showManual = true)}
						>
							<Keyboard size={16} />
							Type barcode
						</button>
					{/if}
					<button
						class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white"
						onclick={onSearchByName}
					>
						<MagnifyingGlass size={16} />
						Search by name
					</button>
				</div>

				<button
					class="cursor-pointer text-center text-xs text-white/60 underline hover:text-white/90"
					onclick={exitShoppingMode}
				>
					Exit shopping mode
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Travel = container h-56 (14rem) minus 0.75rem inset top and bottom. */
	.scanline {
		top: 0.75rem;
		animation: sweep 2s ease-in-out infinite alternate;
	}

	@keyframes sweep {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(12.375rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scanline {
			top: 50%;
			animation: none;
		}
	}
</style>
