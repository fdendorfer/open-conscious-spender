<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { CaretDown, MagnifyingGlass, X } from 'phosphor-svelte';
	import Logo from './Logo.svelte';
	import CompanySearch from './CompanySearch.svelte';
	import { loadDataset, type Dataset, type Company } from '$lib/dataset';

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
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && searchOpen) closeSearch();
	}}
/>

<nav class="sticky top-0 z-50 flex items-center gap-6 bg-white px-6 py-3">
	<div class="relative flex shrink-0 items-center gap-1">
		<a href={resolve('/')} class="flex items-center gap-2 font-semibold text-gray-900">
			<Logo class="h-6 w-6" />
			<span>Conscious</span>
		</a>
		<button
			class="cursor-pointer rounded p-1 text-gray-400 hover:text-gray-900 sm:hidden"
			aria-label="Open navigation menu"
			aria-expanded={logoMenuOpen}
			onclick={() => (logoMenuOpen = !logoMenuOpen)}
		>
			<CaretDown size={14} />
		</button>

		{#if logoMenuOpen}
			<div
				class="absolute top-full left-0 z-50 mt-2 w-40 rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg"
			>
				{#each NAV_LINKS as link (link.label)}
					<a
						href={link.href}
						class="block px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
						onclick={() => (logoMenuOpen = false)}
					>
						{link.label}
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<div class="hidden items-center gap-6 text-sm text-gray-500 sm:flex">
		{#each NAV_LINKS as link (link.label)}
			<a href={link.href} class="transition-colors hover:text-gray-900">{link.label}</a>
		{/each}
	</div>

	<div class="ml-auto flex shrink-0 items-center gap-3">
		<button
			class="cursor-pointer rounded p-1.5 text-gray-500 hover:text-gray-900"
			aria-label="Search companies"
			onclick={openSearch}
		>
			<MagnifyingGlass size={20} />
		</button>

		{#if deferredPrompt}
			<button
				class="shrink-0 cursor-pointer rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400"
				onclick={installApp}
			>
				Install app
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
		class="fixed inset-0 z-[60] cursor-default bg-black/40"
		aria-label="Close search"
		onclick={closeSearch}
	></button>
	<div class="pointer-events-none fixed inset-0 z-[61] flex flex-col items-center px-4 pt-24">
		<div class="pointer-events-auto w-full max-w-md rounded-xl bg-white p-4 shadow-2xl">
			<div class="mb-3 flex items-center justify-between">
				<span class="text-sm font-medium text-gray-900">Search companies</span>
				<button
					class="cursor-pointer rounded p-1 text-gray-400 hover:text-gray-900"
					aria-label="Close search"
					onclick={closeSearch}
				>
					<X size={18} />
				</button>
			</div>
			<CompanySearch
				bind:this={searchComponent}
				dataset={searchDataset}
				onSelect={goToCompany}
				onEscape={closeSearch}
			/>
		</div>
	</div>
{/if}
