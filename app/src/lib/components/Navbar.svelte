<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		Barcode,
		Basket,
		CaretDown,
		DownloadSimple,
		MagnifyingGlass,
		Moon,
		Sun,
		X
	} from 'phosphor-svelte';
	import Logo from './Logo.svelte';
	import CompanySearch from './CompanySearch.svelte';
	import ScannerOverlay from './ScannerOverlay.svelte';
	import { loadDataset, type Dataset, type Company } from '$lib/dataset';
	import { shoppingMode } from '$lib/shoppingMode.svelte';
	import { theme } from '$lib/theme.svelte';
	import { scanner } from '$lib/scannerBus.svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	const NAV_LINKS = [
		{ href: resolve('/'), label: 'Get Started' },
		{ href: resolve('/companies'), label: 'Ranking' },
		{ href: resolve('/scoring'), label: 'Scoring' },
		{ href: resolve('/#about'), label: 'About' }
	];

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);

	let logoMenuOpen = $state(false);
	let searchOpen = $state(false);
	let searchDataset = $state<Dataset | null>(null);
	let searchComponent = $state<CompanySearch | undefined>(undefined);

	onMount(() => {
		shoppingMode.hydrate();
		theme.hydrate();
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		});
		window.addEventListener('appinstalled', () => {
			deferredPrompt = null;
		});
	});

	async function installApp() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') deferredPrompt = null;
	}

	function onLogoClick(e: MouseEvent) {
		// Let modifier-clicks (open in new tab, etc.) and desktop clicks behave like a normal link.
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
		if (window.matchMedia('(min-width: 640px)').matches) return;
		e.preventDefault();
		logoMenuOpen = !logoMenuOpen;
	}

	async function openSearch() {
		searchOpen = true;
		logoMenuOpen = false;
		if (!searchDataset) searchDataset = await loadDataset();
		await tick();
		searchComponent?.focus();
	}

	function closeSearch() {
		searchOpen = false;
	}

	function goToCompany(company: Company) {
		closeSearch();
		goto(resolve('/brand/[slug]', { slug: company.id }));
	}

	/** In shopping mode the primary action is the camera, not the name search. */
	function onPrimaryAction() {
		if (shoppingMode.enabled) scanner.open();
		else openSearch();
	}

	function toggleShoppingMode() {
		logoMenuOpen = false;
		if (shoppingMode.enabled) {
			shoppingMode.disable();
			scanner.close();
			return;
		}
		shoppingMode.enable();
		if (shoppingMode.introSeen) scanner.open();
		else goto(resolve('/shopping'));
	}

	function searchFromScanner() {
		scanner.close();
		openSearch();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && searchOpen) closeSearch();
	}}
/>

<nav class="sticky top-0 z-50 flex items-center gap-6 bg-white px-6 py-3 dark:bg-zinc-950">
	<div class="relative flex shrink-0 items-center gap-1">
		<a
			href={resolve('/')}
			class="flex items-center gap-2 font-semibold text-gray-900 dark:text-zinc-100"
			onclick={onLogoClick}
			aria-haspopup="true"
			aria-expanded={logoMenuOpen}
		>
			<Logo class="h-6 w-6" />
			<span>Conscious</span>
			<CaretDown size={14} class="text-gray-400 sm:hidden dark:text-zinc-400" />
		</a>

		{#if logoMenuOpen}
			<div
				class="absolute top-full left-0 z-50 mt-2 w-40 rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
			>
				{#each NAV_LINKS as link (link.label)}
					<a
						href={link.href}
						class="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
						onclick={() => (logoMenuOpen = false)}
					>
						{link.label}
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<div class="hidden items-center gap-6 text-sm text-gray-500 sm:flex dark:text-zinc-300">
		{#each NAV_LINKS as link (link.label)}
			<a href={link.href} class="transition-colors hover:text-gray-900 dark:hover:text-zinc-100"
				>{link.label}</a
			>
		{/each}
	</div>

	<div class="ml-auto flex shrink-0 items-center gap-1">
		<button
			class="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100"
			aria-label={shoppingMode.enabled ? 'Scan a barcode' : 'Search companies'}
			onclick={onPrimaryAction}
		>
			{#if shoppingMode.enabled}
				<Barcode size={20} />
			{:else}
				<MagnifyingGlass size={20} />
			{/if}
		</button>

		<button
			class="cursor-pointer rounded-lg p-1.5 transition-colors {shoppingMode.enabled
				? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
				: 'text-gray-500 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
			aria-pressed={shoppingMode.enabled}
			aria-label={shoppingMode.enabled ? 'Exit shopping mode' : 'Enter shopping mode'}
			title={shoppingMode.enabled ? 'Exit shopping mode' : 'Shopping mode'}
			onclick={toggleShoppingMode}
		>
			<Basket size={20} weight={shoppingMode.enabled ? 'fill' : 'regular'} />
		</button>

		<button
			class="cursor-pointer rounded-lg p-1.5 text-gray-500 transition-colors hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100"
			aria-label={theme.resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
			title={theme.resolved === 'dark' ? 'Light theme' : 'Dark theme'}
			onclick={() => theme.toggle()}
		>
			{#if theme.resolved === 'dark'}
				<Sun size={20} />
			{:else}
				<Moon size={20} />
			{/if}
		</button>

		{#if deferredPrompt}
			<button
				class="cursor-pointer rounded-lg p-1.5 text-gray-500 transition-colors hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-100"
				aria-label="Install app"
				title="Install app"
				onclick={installApp}
			>
				<DownloadSimple size={20} />
			</button>
		{/if}
	</div>
</nav>

{#if logoMenuOpen}
	<!-- Click-outside backdrop for the logo dropdown, sits below the menu itself. -->
	<button
		class="fixed inset-0 z-40 cursor-default"
		aria-label="Close navigation menu"
		onclick={() => (logoMenuOpen = false)}
	></button>
{/if}

{#if searchOpen}
	<button
		class="fixed inset-0 z-[60] cursor-default bg-black/40 dark:bg-black/70"
		aria-label="Close search"
		onclick={closeSearch}
	></button>
	<div class="pointer-events-none fixed inset-0 z-[61] flex flex-col items-center px-4 pt-24">
		<div
			class="pointer-events-auto w-full max-w-md rounded-xl bg-white p-4 shadow-2xl dark:border dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/80"
		>
			<div class="mb-3 flex items-center justify-between">
				<span class="text-sm font-medium text-gray-900 dark:text-zinc-100">Search companies</span>
				<button
					class="cursor-pointer rounded p-1 text-gray-400 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100"
					aria-label="Close search"
					onclick={closeSearch}
				>
					<X size={18} />
				</button>
			</div>
			<CompanySearch
				bind:this={searchComponent}
				dataset={searchDataset}
				floatResults={false}
				onSelect={goToCompany}
				onEscape={closeSearch}
			/>
		</div>
	</div>
{/if}

{#if scanner.isOpen}
	<ScannerOverlay onClose={() => scanner.close()} onSearchByName={searchFromScanner} />
{/if}
