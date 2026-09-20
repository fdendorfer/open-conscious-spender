<script lang="ts">
	import type { Company } from '$lib/dataset';

	let { company }: { company: Company } = $props();
</script>

<div>
	<h1 class="text-2xl font-semibold">{company.name}</h1>
	<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-zinc-300">
		{#if company.country}<span>{company.country}</span>{/if}
		{#if company.aliases.length > 0}
			<span class="text-gray-300 dark:text-zinc-500">·</span>
			<span class="text-xs">Also known as: {company.aliases.join(', ')}</span>
		{/if}
		{#if company.brands.length > 0}
			<span class="text-gray-300 dark:text-zinc-500">·</span>
			<span class="text-xs">Brands: {company.brands.join(', ')}</span>
		{/if}
	</div>
</div>
