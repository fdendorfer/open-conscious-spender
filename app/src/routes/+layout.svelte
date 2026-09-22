<script lang="ts">
	import './layout.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import { SITE_DESCRIPTION, SITE_FULL_NAME, SITE_URL } from '$lib/seo';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/icon.svg" />
	<meta name="description" content={SITE_DESCRIPTION} />
	<meta property="og:site_name" content={SITE_FULL_NAME} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={SITE_FULL_NAME} />
	<meta property="og:description" content={SITE_DESCRIPTION} />
	<meta property="og:image" content="{SITE_URL}/pwa-512x512.png" />
	<meta name="twitter:card" content="summary" />
</svelte:head>
<Navbar />
{@render children()}
