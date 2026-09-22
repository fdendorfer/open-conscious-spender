<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Company } from '$lib/dataset';

	let { chain }: { chain: Company[] } = $props();
</script>

<div class="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 dark:border-zinc-700">
	<h3 class="text-sm font-medium">Parent company</h3>
	<div class="flex flex-col gap-1">
		{#each chain as c, i (c.id)}
			<div class="flex items-center gap-1 text-sm" style:padding-left="{i * 12}px">
				{#if i > 0}<span class="text-xs text-gray-300 dark:text-zinc-500">↳</span>{/if}
				{#if i === 0}
					<span class="font-medium">{c.name}</span>
				{:else}
					<a
						href={resolve('/brand/[slug]', { slug: c.id })}
						class="text-blue-600 hover:underline dark:text-blue-400">{c.name}</a
					>
				{/if}
			</div>
		{/each}
	</div>
</div>
