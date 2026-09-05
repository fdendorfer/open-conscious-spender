<script lang="ts">
	import { resolve } from '$app/paths';
	import categories from '../../../data/categories.json';
	import { CATEGORY_ICONS } from '$lib/categoryIcons';
</script>

<main class="mx-auto flex max-w-sm flex-col gap-8 p-6">
	<div class="flex flex-col items-center gap-3 pt-8 text-center">
		<h1 class="text-2xl font-semibold">Open Conscious Spender</h1>
		<p class="text-gray-600">
			Search a company (or scan its barcode). See its red flags at a glance. Decide in seconds —
			before you're stuck reading in the aisle.
		</p>
		<a class="rounded-xl bg-gray-900 px-6 py-3 font-medium text-white" href={resolve('/search')}>
			Find a company
		</a>
	</div>

	<section class="flex flex-col gap-3">
		<h2 class="font-medium">How it works</h2>
		<ol class="flex flex-col gap-2 text-sm text-gray-600">
			<li>1. Search a company by name, or scan a barcode if you don't know it.</li>
			<li>2. See flag icons and a score — no reading required to make a call.</li>
			<li>
				3. Missing something? Add it — it goes straight into a public pull request for review.
			</li>
		</ol>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="font-medium">What we track</h2>
		<p class="text-sm text-gray-600">
			Every flag falls into one of these categories, each weighted differently in the score:
		</p>
		<ul class="grid grid-cols-2 gap-3">
			{#each categories as category (category.id)}
				{@const Icon = CATEGORY_ICONS[category.icon]}
				<li class="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm">
					{#if Icon}
						<Icon size={24} />
					{/if}
					{category.name}
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-2 pb-8">
		<h2 class="font-medium">Open and community-maintained</h2>
		<p class="text-sm text-gray-600">
			Anyone can add a company or a flag — no account needed. The full dataset is public and openly
			licensed (CC BY 4.0); every change is a reviewable pull request on
			<a
				class="underline"
				href="https://github.com/fdendorfer/open-conscious-spender"
				target="_blank"
				rel="noreferrer external">GitHub</a
			>.
		</p>
	</section>
</main>
