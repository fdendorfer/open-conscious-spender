<script lang="ts">
	import { resolve } from '$app/paths';
	import { saturate } from '$lib/scoring';

	type CategoryRow = { name: string; redPts: number; greenPts: number };

	let {
		rawPos,
		rawNeg,
		categoryBreakdown
	}: {
		rawPos: number;
		rawNeg: number;
		categoryBreakdown: CategoryRow[];
	} = $props();

	function signed(n: number): string {
		return `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(1)}`;
	}

	let saturatedPos = $derived(saturate(rawPos));
	let saturatedNeg = $derived(-saturate(rawNeg));
	// rounded the same way as the headline score above, so the two always agree
	let total = $derived(Math.round(saturatedPos + saturatedNeg));
</script>

<div class="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
	<h3 class="text-sm font-medium">How the score was calculated</h3>

	{#if categoryBreakdown.length === 0}
		<p class="text-xs text-gray-400">No flags recorded yet — score defaults to 0.</p>
	{:else}
		<div class="flex flex-col gap-1 font-mono text-xs">
			{#each categoryBreakdown as { name, redPts, greenPts }}
				{@const net = greenPts - redPts}
				<div class="flex justify-between gap-4 text-gray-600">
					<span class="min-w-0 truncate">{name}</span>
					<span class={net < 0 ? 'text-red-500' : 'text-green-600'}>{signed(net)}</span>
				</div>
			{/each}
			<div class="my-0.5 border-t border-gray-100"></div>
			<div class="flex justify-between gap-4 text-gray-600">
				<span>Raw positive</span>
				<span class="text-green-600">{signed(rawPos)}</span>
			</div>
			<div class="flex justify-between gap-4 text-gray-600">
				<span>Raw negative</span>
				<span class="text-red-500">{signed(-rawNeg)}</span>
			</div>

			<p class="mt-2 text-gray-400">Saturate with 100 × (1 − e^(−raw / K))</p>

			<div class="flex justify-between gap-4 text-gray-600">
				<span>Saturated positive</span>
				<span class="text-green-600">{signed(saturatedPos)}</span>
			</div>
			<div class="flex justify-between gap-4 text-gray-600">
				<span>Saturated negative</span>
				<span class="text-red-500">{signed(saturatedNeg)}</span>
			</div>
			<div class="my-0.5 border-t border-gray-100"></div>
			<div class="flex justify-between gap-4 font-medium text-gray-900">
				<span>Total</span>
				<span>{signed(total)}</span>
			</div>
		</div>
	{/if}

	<a href={resolve('/scoring')} class="text-xs text-blue-600 hover:underline">
		Learn more about how we score →
	</a>
</div>
