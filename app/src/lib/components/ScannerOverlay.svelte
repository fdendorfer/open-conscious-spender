<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		Barcode,
		ClockCounterClockwise,
		Info,
		MagnifyingGlass,
		WifiSlash,
		X
	} from 'phosphor-svelte';
	import { startBarcodeScan, CameraUnavailableError, type ScanHandle } from '$lib/barcodeScanner';
	import { loadDataset, type Dataset, type Company } from '$lib/dataset';
	import { lookupBarcode } from '$lib/lookup';
	import { shoppingMode } from '$lib/shoppingMode.svelte';
	import { scanTrip } from '$lib/scanTrip.svelte';
	import ScanResultSheet from './ScanResultSheet.svelte';
	import TripSummary from './TripSummary.svelte';

	const INTRO_STEPS = [
		{
			title: 'Point at the barcode',
			body: 'The camera reads it automatically. Hold the pack steady in the frame.'
		},
		{
			title: 'Glance at the score',
			body: 'A colour and a number show where the owner stands.'
		},
		{
			title: 'Scan the next item',
			body: 'Dismiss the result and the camera picks straight back up.'
		}
	];

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
	let missKind = $state<'unknown-brand' | 'not-found' | 'offline'>('not-found');
	let cameraError = $state<string | null>(null);

	let panel = $state<'intro' | 'trip' | null>(shoppingMode.introSeen ? null : 'intro');

	let overlayEl = $state<HTMLDivElement | undefined>(undefined);
	let sheetEl = $state<HTMLDivElement | undefined>(undefined);
	let statusEl = $state<HTMLParagraphElement | undefined>(undefined);
	let closeButton = $state<HTMLButtonElement | undefined>(undefined);

	/** Makes everything but the overlay inert, which also traps Tab inside it. */
	function inertBackground(): () => void {
		const siblings = [...(overlayEl?.parentElement?.children ?? [])].filter(
			(el): el is HTMLElement => el !== overlayEl && el instanceof HTMLElement && !el.inert
		);
		for (const el of siblings) el.inert = true;
		return () => {
			for (const el of siblings) el.inert = false;
		};
	}

	onMount(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const restoreBackground = inertBackground();

		void loadDataset().then((d) => (dataset = d));
		// The intro comes first, so the camera permission prompt does not cover it.
		if (panel !== 'intro') {
			cameraRequested = true;
			void startCamera();
		}

		return () => {
			document.body.style.overflow = previousOverflow;
			restoreBackground();
			// Search by name opens its own dialog; focus belongs there, not on the opener.
			if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus();
		};
	});

	// Moves focus to whatever replaced the previous view, so it is read out and Tab starts there.
	let view = $derived(panel ?? (phase === 'found' || phase === 'miss' ? phase : 'camera'));
	$effect(() => {
		void view;
		void tick().then(() => {
			const heading = sheetEl?.querySelector<HTMLElement>('h2');
			if (heading) {
				heading.tabIndex = -1;
				heading.focus();
			} else if (view === 'camera') {
				(statusEl ?? closeButton)?.focus();
			}
		});
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
					? 'No camera access. Search by name instead.'
					: 'Something went wrong starting the camera.';
			phase = 'camera-error';
		}
	}

	function onBarcodeDetected(raw: string) {
		void runLookup(raw);
	}

	let cameraRequested = false;

	function closePanel() {
		shoppingMode.markIntroSeen();
		panel = null;
		if (!cameraRequested) {
			cameraRequested = true;
			void startCamera();
		} else if (phase === 'scanning') {
			scanHandle?.resume();
		}
	}

	function togglePanel(name: 'intro' | 'trip') {
		if (panel === name) {
			closePanel();
			return;
		}
		panel = name;
		scanHandle?.pause();
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
		missKind = lookup.status;
		missBrand = lookup.status === 'unknown-brand' ? lookup.brand : null;
		missGtin = gtin;
		buzz();
		phase = 'miss';
	}

	// Single decision point for a resolved scan — swap this for a goto() to the
	// brand page if the in-overlay sheet ever proves worse in practice.
	function showFound(company: Company) {
		result = company;
		scanTrip.record(company.id);
		buzz();
		phase = 'found';
	}

	/** Confirms the scan landed without asking anyone to look up from the shelf. */
	function buzz() {
		try {
			navigator.vibrate?.(20);
		} catch {
			// unsupported or blocked by a permissions policy — visual feedback is enough
		}
	}

	function scanNext() {
		result = null;
		missKind = 'not-found';
		missBrand = null;
		missGtin = null;
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
		if (missGtin) target.searchParams.set('gtin', missGtin);
		onClose();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() can't carry a query string
		goto(target);
	}

	function exitShoppingMode() {
		shoppingMode.disable();
		onClose();
	}

	let sheetOpen = $derived(phase === 'found' || phase === 'miss' || panel !== null);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onClose();
	}}
/>

<div
	bind:this={overlayEl}
	class="fixed inset-0 z-[70] flex flex-col bg-gray-950 text-white"
	role="dialog"
	aria-modal="true"
	aria-label="Barcode scanner"
>
	<header class="flex shrink-0 items-center gap-3 px-4 py-3">
		<span class="mr-auto flex items-center gap-2 text-sm font-medium">
			<Barcode size={20} />
			Shopping mode
		</span>
		{#each [{ name: 'intro', label: 'How it works', icon: Info }, { name: 'trip', label: 'This trip', icon: ClockCounterClockwise }] as const as button (button.name)}
			<button
				class="cursor-pointer rounded-full p-2 transition-colors disabled:invisible {panel ===
				button.name
					? 'bg-white text-gray-900'
					: 'text-white/70 hover:bg-white/10 hover:text-white'}"
				aria-label={button.label}
				aria-pressed={panel === button.name}
				disabled={!shoppingMode.introSeen}
				onclick={() => togglePanel(button.name)}
			>
				<button.icon size={22} />
			</button>
		{/each}
		<button
			class="cursor-pointer rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
			aria-label="Close camera"
			bind:this={closeButton}
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
			<p role="alert" class="relative max-w-xs px-6 text-center text-sm text-white/80">
				{cameraError}
			</p>
		{/if}
	</div>

	<div class="shrink-0">
		{#if sheetOpen}
			<div
				bind:this={sheetEl}
				class="max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white text-gray-900 dark:bg-zinc-900 dark:text-zinc-100"
			>
				{#if panel === 'intro'}
					<section class="flex flex-col gap-5 p-5" aria-labelledby="shopping-intro-title">
						<div>
							<h2 id="shopping-intro-title" class="text-xl font-semibold">Shopping mode</h2>
							<p class="mt-1 text-sm text-gray-600 dark:text-zinc-300">
								The camera becomes your search bar, so checking who owns a product takes a second.
							</p>
						</div>
						<ol class="flex flex-col gap-4">
							{#each INTRO_STEPS as step, i (step.title)}
								<li class="flex gap-3">
									<span
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-200"
									>
										{i + 1}
									</span>
									<div class="flex flex-col gap-0.5">
										<h3 class="text-sm font-medium">{step.title}</h3>
										<p class="text-sm text-gray-600 dark:text-zinc-300">{step.body}</p>
									</div>
								</li>
							{/each}
						</ol>
						<p class="flex items-start gap-2 text-xs text-gray-500 dark:text-zinc-400">
							<WifiSlash size={16} class="shrink-0" />
							Shopping mode stays on until you turn it off. Unknown barcodes need a connection.
						</p>
						<button
							class="cursor-pointer rounded-xl bg-primary px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
							onclick={closePanel}
						>
							{shoppingMode.introSeen ? 'Back to scanning' : 'Start scanning'}
						</button>
					</section>
				{:else if panel === 'trip'}
					<div class="flex flex-col gap-3 p-4">
						<TripSummary />
						<button
							class="cursor-pointer rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
							onclick={closePanel}
						>
							Back to scanning
						</button>
					</div>
				{:else if phase === 'found' && result && dataset}
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
								class="cursor-pointer rounded-xl bg-primary px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
								onclick={addMissingBrand}
							>
								Request a rating
							</button>
						{:else if missKind === 'offline'}
							<div>
								<h2 class="text-xl font-semibold">Offline</h2>
								<p class="mt-1 text-sm text-gray-600 dark:text-zinc-300">
									This barcode isn't one of the {Object.keys(dataset?.barcodeOverrides ?? {})
										.length}
									known offline, and looking up the brand needs a connection. Scanned products are remembered,
									so try again once you're back on.
								</p>
							</div>
							<button
								class="cursor-pointer rounded-xl bg-primary px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
								onclick={() => missGtin && runLookup(missGtin)}
							>
								Try again
							</button>
						{:else}
							<div>
								<h2 class="text-xl font-semibold">No match</h2>
								<p class="mt-1 text-sm text-gray-600 dark:text-zinc-300">
									Nothing found for barcode {missGtin}. It may not be in Open Food Facts yet.
								</p>
							</div>
							<button
								class="cursor-pointer rounded-xl bg-primary px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
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
				<p
					bind:this={statusEl}
					role="status"
					tabindex="-1"
					class="text-center text-sm text-white/70 outline-none"
				>
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

				<div class="flex items-center justify-center gap-2 text-sm">
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
