<script lang="ts">
	import { Barcode, Check, MagnifyingGlass, WifiSlash } from 'phosphor-svelte';
	import { shoppingMode } from '$lib/shoppingMode.svelte';
	import { scanner } from '$lib/scannerBus.svelte';
	import { pageTitle } from '$lib/seo';

	const STEPS = [
		{
			title: 'Point at the barcode',
			body: 'The camera reads it automatically — no shutter button, no tapping. Hold the pack steady in the frame.'
		},
		{
			title: 'Glance at the score',
			body: 'A colour and a number tell you where the owner stands, with icons for the categories behind it. No reading required.'
		},
		{
			title: 'Scan the next item',
			body: 'Dismiss the result and the camera picks straight back up. Work through a basket without leaving the screen.'
		}
	];

	function startNow() {
		shoppingMode.enable();
		shoppingMode.markIntroSeen();
		scanner.open();
	}
</script>

<svelte:head>
	<title>{pageTitle('Shopping mode')}</title>
</svelte:head>

<main class="mx-auto flex max-w-lg flex-col gap-8 px-6 py-10">
	<div class="flex flex-col items-center gap-3 text-center">
		<span class="rounded-2xl bg-gray-900 p-3 text-white dark:bg-zinc-100 dark:text-zinc-900">
			<Barcode size={28} />
		</span>
		<h1 class="text-2xl font-semibold">Shopping mode</h1>
		<p class="text-gray-600 dark:text-zinc-300">
			Built for standing in the aisle. The camera becomes your search bar, so checking who owns a
			product takes a second instead of a minute.
		</p>
	</div>

	<ol class="flex flex-col gap-5">
		{#each STEPS as step, i (step.title)}
			<li class="flex gap-4">
				<span
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-200"
				>
					{i + 1}
				</span>
				<div class="flex flex-col gap-1">
					<h2 class="font-medium">{step.title}</h2>
					<p class="text-sm text-gray-600 dark:text-zinc-300">{step.body}</p>
				</div>
			</li>
		{/each}
	</ol>

	<div class="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5 dark:border-zinc-700">
		<h2 class="text-sm font-medium">While shopping mode is on</h2>
		<ul class="flex flex-col gap-2.5 text-sm text-gray-600 dark:text-zinc-300">
			<li class="flex items-start gap-2.5">
				<Barcode size={18} class="mt-0.5 shrink-0 text-gray-400 dark:text-zinc-400" />
				The search button in the nav bar opens the camera instead of name search.
			</li>
			<li class="flex items-start gap-2.5">
				<MagnifyingGlass size={18} class="mt-0.5 shrink-0 text-gray-400 dark:text-zinc-400" />
				Name search is still one tap away from inside the camera view.
			</li>
			<li class="flex items-start gap-2.5">
				<WifiSlash size={18} class="mt-0.5 shrink-0 text-gray-400 dark:text-zinc-400" />
				Known barcodes resolve offline; unknown ones need a connection to look up.
			</li>
			<li class="flex items-start gap-2.5">
				<Check size={18} class="mt-0.5 shrink-0 text-gray-400 dark:text-zinc-400" />
				It stays on until you turn it off, so a reload mid-shop won't lose it.
			</li>
		</ul>
	</div>

	<button
		class="cursor-pointer rounded-xl bg-gray-900 px-4 py-3.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
		onclick={startNow}
	>
		Start now
	</button>
</main>
