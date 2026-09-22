<script lang="ts">
	import type { Company } from '$lib/dataset';

	let { company }: { company: Company } = $props();

	// Separators are rendered with the part they follow, so a wrap can never
	// strand one at the end of a line or lead with one when country is null.
	let parts = $derived(
		[
			company.country ? { text: company.country, small: false } : null,
			company.aliases.length > 0
				? { text: `Also known as: ${company.aliases.join(', ')}`, small: true }
				: null,
			company.brands.length > 0
				? { text: `Brands: ${company.brands.join(', ')}`, small: true }
				: null
		].filter((part) => part !== null)
	);
</script>

<div>
	<h1 class="text-2xl font-semibold">{company.name}</h1>
	{#if parts.length > 0}
		<div
			class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-zinc-300"
		>
			{#each parts as part, i (part.text)}
				<span class="flex items-center gap-2">
					<span class:text-xs={part.small}>{part.text}</span>
					{#if i < parts.length - 1}
						<span class="text-gray-300 dark:text-zinc-500">·</span>
					{/if}
				</span>
			{/each}
		</div>
	{/if}
</div>
