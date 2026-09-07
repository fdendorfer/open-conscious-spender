<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Logo from './Logo.svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);

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
</script>

<nav class="sticky top-0 z-50 flex items-center gap-6 bg-neutral-950 px-6 py-3 text-white">
	<a href={resolve('/')} class="flex shrink-0 items-center gap-2 font-semibold text-white">
		<Logo class="h-6 w-6" />
		<span>Conscious</span>
	</a>

	<div class="flex flex-1 items-center justify-center gap-6 text-sm text-neutral-300">
		<a href={resolve('/#how-it-works')} class="transition-colors hover:text-white">How it works</a>
		<a href={resolve('/#about')} class="transition-colors hover:text-white">About</a>
		<a href={resolve('/companies')} class="transition-colors hover:text-white">Companies</a>
	</div>

	{#if deferredPrompt}
		<button
			class="shrink-0 cursor-pointer rounded-md border border-neutral-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-neutral-400"
			onclick={installApp}
		>
			Install app
		</button>
	{/if}
</nav>
