<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowClockwise,
		CheckCircle,
		CloudArrowDown,
		Desktop,
		Moon,
		Sun,
		Trash,
		Warning,
		WifiSlash
	} from 'phosphor-svelte';
	import {
		clearCachedDataset,
		downloadDataset,
		fetchDatasetMeta,
		getCachedDataset,
		type Dataset,
		type DatasetMeta
	} from '$lib/dataset';
	import {
		clearDeviceData,
		ensureAppFilesCached,
		readDeviceStorage,
		type DeviceStorage
	} from '$lib/deviceData';
	import { searchHistory } from '$lib/searchHistory.svelte';
	import { shoppingMode } from '$lib/shoppingMode.svelte';
	import { theme, type ThemeSetting } from '$lib/theme.svelte';
	import { pageTitle } from '$lib/seo';

	const THEME_OPTIONS: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
		{ value: 'system', label: 'System', icon: Desktop },
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon }
	];

	type Busy = 'download' | 'clear-dataset' | 'clear-all';

	let cached = $state<Dataset | null>(null);
	let meta = $state<DatasetMeta | null>(null);
	let storage = $state<DeviceStorage | null>(null);
	let busy = $state<Busy | null>(null);
	let error = $state<string | null>(null);
	let confirmingClearAll = $state(false);

	let downloadBytes = $derived(meta?.bytes ?? null);
	let companyCount = $derived(cached?.companies.length ?? meta?.companies ?? null);
	let upToDate = $derived(!!cached && !!meta && cached.version === meta.version);

	onMount(async () => {
		theme.hydrate();
		await refresh();
	});

	async function refresh() {
		cached = (await getCachedDataset()) ?? null;
		storage = await readDeviceStorage();
		try {
			meta = await fetchDatasetMeta();
		} catch {
			meta = null; // offline — the cached copy is still described from what is on device
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	async function download() {
		busy = 'download';
		error = null;
		try {
			cached = await downloadDataset();
			await ensureAppFilesCached();
		} catch {
			error = 'Download failed. Check your connection and try again.';
		} finally {
			storage = await readDeviceStorage();
			busy = null;
		}
	}

	async function removeDataset() {
		busy = 'clear-dataset';
		error = null;
		await clearCachedDataset();
		cached = null;
		storage = await readDeviceStorage();
		busy = null;
	}

	async function removeEverything() {
		busy = 'clear-all';
		error = null;
		await clearDeviceData();
		theme.hydrate();
		shoppingMode.hydrate();
		searchHistory.hydrate();
		cached = null;
		confirmingClearAll = false;
		storage = await readDeviceStorage();
		busy = null;
	}
</script>

<svelte:head><title>{pageTitle('Settings')}</title></svelte:head>

<main class="mx-auto flex max-w-xl flex-col gap-10 px-6 py-10">
	<h1 class="text-2xl font-semibold">Settings</h1>

	<section class="flex flex-col gap-3">
		<h2 class="font-medium">Appearance</h2>
		<p class="text-sm text-gray-600 dark:text-zinc-300">
			“System” follows your device’s light or dark setting.
		</p>
		<div
			class="inline-flex self-start rounded-xl border border-gray-200 p-1 dark:border-zinc-700"
			role="group"
			aria-label="Colour theme"
		>
			{#each THEME_OPTIONS as option (option.value)}
				{@const Icon = option.icon}
				{@const active = theme.setting === option.value}
				<button
					class="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors {active
						? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
						: 'text-gray-600 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					aria-pressed={active}
					onclick={() => theme.set(option.value)}
				>
					<Icon size={16} />
					{option.label}
				</button>
			{/each}
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="font-medium">Offline use</h2>
		<p class="text-sm text-gray-600 dark:text-zinc-300">
			Keep the companies data on your device so lookups work with no signal — a shop basement, a
			train, anywhere.
		</p>

		<ul class="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 dark:border-zinc-700">
			<li class="flex items-start gap-2 text-sm">
				{#if cached}
					<CheckCircle
						size={18}
						weight="fill"
						class="mt-0.5 shrink-0 text-green-600 dark:text-green-400"
					/>
					<span class="text-gray-600 dark:text-zinc-300">
						<span class="font-medium text-gray-900 dark:text-zinc-100">Companies data saved</span>
						{#if companyCount}— {companyCount} companies{/if}
						{#if downloadBytes}, {formatBytes(downloadBytes)}{/if}
						{#if meta && !upToDate}
							<span class="text-amber-600 dark:text-amber-400"> · update available</span>
						{/if}
					</span>
				{:else}
					<CloudArrowDown size={18} class="mt-0.5 shrink-0 text-gray-400 dark:text-zinc-400" />
					<span class="text-gray-600 dark:text-zinc-300">
						<span class="font-medium text-gray-900 dark:text-zinc-100"
							>Companies data not saved</span
						>
						{#if downloadBytes}— {formatBytes(downloadBytes)} to download{/if}
						{#if companyCount}, {companyCount} companies{/if}
					</span>
				{/if}
			</li>

			<li class="flex items-start gap-2 text-sm">
				{#if storage?.appFilesCached}
					<CheckCircle
						size={18}
						weight="fill"
						class="mt-0.5 shrink-0 text-green-600 dark:text-green-400"
					/>
					<span class="font-medium text-gray-900 dark:text-zinc-100">App files saved</span>
				{:else}
					<WifiSlash size={18} class="mt-0.5 shrink-0 text-gray-400 dark:text-zinc-400" />
					<span class="text-gray-600 dark:text-zinc-300">
						<span class="font-medium text-gray-900 dark:text-zinc-100">App files not saved yet</span
						>
						— they are stored automatically a moment after your first visit.
					</span>
				{/if}
			</li>

			{#if storage?.usageBytes}
				<li class="text-sm text-gray-500 dark:text-zinc-400">
					{formatBytes(storage.usageBytes)} used on this device in total.
				</li>
			{/if}
		</ul>

		{#if error}
			<p class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
				<Warning size={16} />
				{error}
			</p>
		{/if}

		<button
			class="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
			disabled={busy !== null}
			onclick={download}
		>
			{#if busy === 'download'}
				<ArrowClockwise size={18} class="animate-spin" />
				Downloading…
			{:else}
				<CloudArrowDown size={18} />
				{cached && upToDate ? 'Download again' : 'Download for offline use'}
				{#if downloadBytes}<span class="font-normal opacity-70">({formatBytes(downloadBytes)})</span
					>{/if}
			{/if}
		</button>
	</section>

	<section class="flex flex-col gap-3 pb-8">
		<h2 class="font-medium">Data on this device</h2>
		<p class="text-sm text-gray-600 dark:text-zinc-300">
			Nothing here ever leaves your device — it is only stored to keep the app fast and usable
			offline.
		</p>

		<button
			class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-100"
			disabled={busy !== null || !cached}
			onclick={removeDataset}
		>
			<Trash size={16} />
			{busy === 'clear-dataset' ? 'Removing…' : 'Remove companies data only'}
		</button>

		{#if confirmingClearAll}
			<div class="flex flex-col gap-3 rounded-xl border border-red-300 p-4 dark:border-red-900/60">
				<p class="text-sm text-gray-600 dark:text-zinc-300">
					This clears your theme choice, shopping mode, recent searches, unsent contribution drafts,
					the companies data and the offline copy of the app. It cannot be undone.
				</p>
				<div class="flex flex-wrap gap-2">
					<button
						class="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						disabled={busy !== null}
						onclick={removeEverything}
					>
						{busy === 'clear-all' ? 'Clearing…' : 'Yes, clear everything'}
					</button>
					<button
						class="cursor-pointer rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-zinc-300"
						disabled={busy !== null}
						onclick={() => (confirmingClearAll = false)}
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-3 text-sm font-medium text-red-600 disabled:opacity-60 dark:border-red-900/60 dark:text-red-400"
				disabled={busy !== null}
				onclick={() => (confirmingClearAll = true)}
			>
				<Trash size={16} />
				Clear everything on this device
			</button>
		{/if}
	</section>
</main>
