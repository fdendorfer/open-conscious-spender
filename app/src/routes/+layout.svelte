<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { reloadIfOutdated } from '$lib/appUpdate';
	import Navbar from '$lib/components/Navbar.svelte';
	import { SITE_DESCRIPTION, SITE_FULL_NAME, SITE_URL } from '$lib/seo';

	let { children } = $props();

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
<Navbar />
{@render children()}
