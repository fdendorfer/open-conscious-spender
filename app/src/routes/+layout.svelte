<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { scanner } from '$lib/scannerBus.svelte';
	import { reloadIfOutdated } from '$lib/appUpdate';
	import Navbar from '$lib/components/Navbar.svelte';
	import { IconContext } from 'phosphor-svelte';
	import { SITE_DESCRIPTION, SITE_FULL_NAME, SITE_URL } from '$lib/seo';

	let { children } = $props();

	// Plain registration on purpose: updates and reloads belong to appUpdate.ts alone.
	if (browser && 'serviceWorker' in navigator) {
		void navigator.serviceWorker.register(dev ? '/dev-sw.js?dev-sw' : '/sw.js', { scope: '/' });
	}

	// Start the next Tab from the new page's content instead of the top of the navbar.
	afterNavigate(({ type, from, to }) => {
		if (type === 'enter' || type === 'popstate') return;
		if (from?.url.pathname === to?.url.pathname) return;
		if (scanner.isOpen || document.querySelector('dialog[open]')) return;
		document.getElementById('main')?.focus({ preventScroll: true });
	});

	onMount(() => {
		void reloadIfOutdated();
		const onVisible = () => document.visibilityState === 'visible' && void reloadIfOutdated();
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});
</script>

<svelte:head>
	<link rel="icon" href="/icon.svg" />
	<link rel="apple-touch-icon" href="/pwa-192x192.png" />
	<meta name="description" content={SITE_DESCRIPTION} />
	<meta property="og:site_name" content={SITE_FULL_NAME} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={SITE_FULL_NAME} />
	<meta property="og:description" content={SITE_DESCRIPTION} />
	<meta property="og:image" content="{SITE_URL}/og-image.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="{SITE_URL}/og-image.png" />
</svelte:head>
<!-- Every icon sits next to text or inside a labelled control, so hide them all from assistive tech. -->
<IconContext values={{ 'aria-hidden': 'true' }}>
	<a
		href="#main"
		class="sr-only z-[60] rounded-xl bg-white px-4 py-2 font-medium text-gray-900 shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2 dark:bg-zinc-900 dark:text-zinc-100"
		>Skip to content</a
	>
	<Navbar />
	<div class="pb-24 sm:pb-0">
		{@render children()}
	</div>
</IconContext>
