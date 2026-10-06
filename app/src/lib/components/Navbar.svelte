<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Barcode,
		Basket,
		DownloadSimple,
		Gear,
		House,
		MagnifyingGlass,
		Moon,
		Sun,
		X
	} from 'phosphor-svelte';
	import Logo from './Logo.svelte';
	import CompanySearch from './CompanySearch.svelte';
	import { loadDataset, type Dataset, type Company } from '$lib/dataset';
	import { shoppingMode } from '$lib/shoppingMode.svelte';
	import { searchHistory } from '$lib/searchHistory.svelte';
	import { scanTrip } from '$lib/scanTrip.svelte';
	import { theme } from '$lib/theme.svelte';
	import { scanner } from '$lib/scannerBus.svelte';
	import { retryPendingDrafts } from '$lib/contribute';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	const NAV_LINKS = [
		{ href: resolve('/'), label: 'Get Started' },
		{ href: resolve('/companies'), label: 'Ranking' },
		{ href: resolve('/scoring'), label: 'Scoring' },
		{ href: resolve('/settings'), label: 'Settings' },
		{ href: resolve('/#about'), label: 'About' }
	];

	// "About" is a hash link into the home page, so it never claims to be the
	// current page — otherwise it would light up alongside "Get Started".
	function isCurrent(href: string): boolean {
		return !href.includes('#') && page.url.pathname === href;
	}

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);

	let menuOpen = $state(false);
	let menuEl = $state<HTMLElement | undefined>(undefined);
	// Some browsers light-dismiss the popover on pointerdown, before the click lands.
	let menuOpenOnPress = false;
	let searchOpen = $state(false);
	let searchDataset = $state<Dataset | null>(null);
	let searchComponent = $state<CompanySearch | undefined>(undefined);
	let searchDialog = $state<HTMLDialogElement | undefined>(undefined);

	// Statically importing the overlay pulled the barcode/WASM stack into the
	// root layout chunk, so every visitor paid for it on first paint.
	let ScannerOverlay = $state<typeof import('./ScannerOverlay.svelte').default | null>(null);
	$effect(() => {
		if (scanner.isOpen && !ScannerOverlay) {
			void import('./ScannerOverlay.svelte').then((m) => (ScannerOverlay = m.default));
		}
	});

	onMount(() => {
		shoppingMode.hydrate();
		theme.hydrate();
		searchHistory.hydrate();
		scanTrip.hydrate();
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		});
		window.addEventListener('appinstalled', () => {
			deferredPrompt = null;
		});

		// Drafts stranded by a failed submit go out again quietly, on load and
		// whenever the device comes back online.
		void retryPendingDrafts();
		window.addEventListener('online', () => void retryPendingDrafts());
	});

	async function installApp() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') deferredPrompt = null;
	}

	// The toggle event that updates menuOpen fires async, so ask the element directly.
	function isMenuOpen(): boolean {
		return menuEl?.matches(':popover-open') ?? false;
	}

	function closeMenu() {
		if (isMenuOpen()) menuEl?.hidePopover();
	}

	/** While the menu is open, the Home button goes home instead of toggling it shut. */
	function onHomeClick(e: MouseEvent) {
		const wasOpen = isMenuOpen() || menuOpenOnPress;
		menuOpenOnPress = false;
		if (!wasOpen) return;
		e.preventDefault();
		closeMenu();
		goto(resolve('/'));
	}

	function goToSettings() {
		closeMenu();
		goto(resolve('/settings'));
	}

	async function openSearch() {
		searchOpen = true;
		closeMenu();
		searchDialog?.showModal();
		if (!searchDataset) searchDataset = await loadDataset();
		await tick();
		searchComponent?.focus();
	}

	function closeSearch() {
		searchDialog?.close();
	}

	function goToCompany(company: Company) {
		closeSearch();
		goto(resolve('/brand/[slug]', { slug: company.id }));
	}

	/** The request form lives on the home page, which picks the brand up from ?add=. */
	function requestRating(query: string) {
		closeSearch();
		const target = new URL(resolve('/'), location.origin);
		target.searchParams.set('add', query);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() can't carry a query string
		goto(target);
	}

	/** In shopping mode the primary action is the camera, not the name search. */
	function onPrimaryAction() {
		if (shoppingMode.enabled) scanner.open();
		else openSearch();
	}

	function toggleShoppingMode() {
		closeMenu();
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

<nav
	class="sticky top-0 z-50 hidden items-center gap-6 bg-white px-6 py-3 sm:flex dark:bg-zinc-950"
>
	<a
		href={resolve('/')}
		class="flex shrink-0 items-center gap-2 font-semibold text-gray-900 dark:text-zinc-100"
	>
		<Logo class="h-6 w-6" />
		<span>Conscious</span>
	</a>

	<div class="flex items-center gap-6 text-sm text-gray-500 dark:text-zinc-300">
		{#each NAV_LINKS as link (link.label)}
			<a
				href={link.href}
				aria-current={isCurrent(link.href) ? 'page' : undefined}
				class="transition-colors hover:text-gray-900 dark:hover:text-zinc-100 {isCurrent(link.href)
					? 'font-medium text-gray-900 dark:text-zinc-100'
					: ''}">{link.label}</a
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
				? 'bg-primary text-white dark:bg-zinc-100 dark:text-zinc-900'
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

<!-- Phones get a thumb-reachable floating pill instead of the top bar. -->
<nav
	class="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full bg-primary p-1.5 shadow-xl shadow-black/25 sm:hidden dark:bg-zinc-100"
>
	<div
		bind:this={menuEl}
		id="nav-menu"
		popover="auto"
		ontoggle={(e) => (menuOpen = e.newState === 'open')}
		class="nav-menu pop-in w-44 origin-bottom rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
	>
		{#each NAV_LINKS as link (link.label)}
			<a
				href={link.href}
				aria-current={isCurrent(link.href) ? 'page' : undefined}
				class="block px-3 py-2 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 {isCurrent(
					link.href
				)
					? 'font-medium text-gray-900 dark:text-zinc-100'
					: 'text-gray-600 dark:text-zinc-300'}"
				onclick={closeMenu}
			>
				{link.label}
			</a>
		{/each}
		{#if deferredPrompt}
			<button
				class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
				onclick={installApp}
			>
				<DownloadSimple size={16} />
				Install app
			</button>
		{/if}
	</div>

	<button
		class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2.5 text-xs transition-colors [anchor-name:--nav-home] {menuOpen ||
		isCurrent(resolve('/'))
			? 'bg-white font-semibold text-gray-900 dark:bg-zinc-900 dark:text-zinc-100'
			: 'text-white/70 hover:text-white dark:text-zinc-900/70 dark:hover:text-zinc-900'}"
		popovertarget="nav-menu"
		aria-expanded={menuOpen}
		aria-label="Navigation menu"
		onpointerdown={() => (menuOpenOnPress = isMenuOpen())}
		onclick={onHomeClick}
	>
		<House size={20} weight={menuOpen ? 'fill' : 'regular'} />
	</button>

	<button
		class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2.5 text-xs text-white/70 transition-colors hover:text-white dark:text-zinc-900/70 dark:hover:text-zinc-900"
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
		class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2.5 text-xs transition-colors {shoppingMode.enabled
			? 'bg-white font-semibold text-gray-900 dark:bg-zinc-900 dark:text-zinc-100'
			: 'text-white/70 hover:text-white dark:text-zinc-900/70 dark:hover:text-zinc-900'}"
		aria-pressed={shoppingMode.enabled}
		aria-label={shoppingMode.enabled ? 'Exit shopping mode' : 'Enter shopping mode'}
		onclick={toggleShoppingMode}
	>
		<Basket size={20} weight={shoppingMode.enabled ? 'fill' : 'regular'} />
	</button>

	<!-- A button, not a link: Safari skips links when tabbing by default. -->
	<button
		class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2.5 text-xs transition-colors {isCurrent(
			resolve('/settings')
		)
			? 'bg-white font-semibold text-gray-900 dark:bg-zinc-900 dark:text-zinc-100'
			: 'text-white/70 hover:text-white dark:text-zinc-900/70 dark:hover:text-zinc-900'}"
		aria-label="Settings"
		aria-current={isCurrent(resolve('/settings')) ? 'page' : undefined}
		onclick={goToSettings}
	>
		<Gear size={20} weight={isCurrent(resolve('/settings')) ? 'fill' : 'regular'} />
	</button>
</nav>

<!-- showModal() gives the focus trap, inert background and Escape handling for free. -->
<dialog
	bind:this={searchDialog}
	class="pop-in mx-auto mt-24 w-[calc(100%-3rem)] max-w-md rounded-xl bg-white p-4 shadow-2xl backdrop:bg-black/60 dark:border dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/80 dark:backdrop:bg-black/85"
	aria-label="Search companies"
	onclose={() => (searchOpen = false)}
	onclick={(e) => {
		if (e.target === searchDialog) closeSearch();
	}}
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
	{#if searchOpen}
		<CompanySearch
			bind:this={searchComponent}
			dataset={searchDataset}
			floatResults={false}
			onSelect={goToCompany}
			onEnterNoResults={requestRating}
			onEscape={closeSearch}
		>
			{#snippet emptyState(query)}
				<div class="flex flex-col gap-2 p-3">
					<p class="text-sm text-gray-600 dark:text-zinc-300">No match for "{query}".</p>
					<button
						class="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
						onclick={() => requestRating(query)}
					>
						Request a rating for "{query}"
					</button>
				</div>
			{/snippet}
		</CompanySearch>
	{/if}
</dialog>

{#if scanner.isOpen && ScannerOverlay}
	<ScannerOverlay onClose={() => scanner.close()} onSearchByName={searchFromScanner} />
{/if}
