<script lang="ts">
	import type { Band } from '$lib/scoring';

	let { score, band }: { score: number; band: Band } = $props();

	// score runs -100..100; the gauge bar below is laid out as a 0%..100% width
	let gaugePercent = $derived((score + 100) / 2);

	const BAND_LABEL: Record<Band, string> = {
		green: 'Low concern',
		yellow: 'Neutral / insufficient data',
		red: 'High concern'
	};
</script>

<div
	class="flex flex-col items-center gap-1 rounded-xl p-6 text-center"
	class:bg-green-50={band === 'green'}
	class:bg-yellow-50={band === 'yellow'}
	class:bg-red-50={band === 'red'}
>
	<span class="text-xs font-medium uppercase tracking-wide text-gray-500">Score</span>
	<span
		class="text-6xl font-bold"
		class:text-green-600={band === 'green'}
		class:text-yellow-600={band === 'yellow'}
		class:text-red-600={band === 'red'}
	>{score}</span>
	<span
		class="text-sm font-medium"
		class:text-green-600={band === 'green'}
		class:text-yellow-600={band === 'yellow'}
		class:text-red-600={band === 'red'}
	>{BAND_LABEL[band]}</span>
	<!-- Score gauge -->
	<div class="relative mt-3 w-full">
		<!-- Downward triangle marker positioned at the score -->
		<div class="relative mb-1 h-2">
			<div
				class="absolute bottom-0"
				style="left: clamp(0px, calc({gaugePercent}% - 4px), calc(100% - 8px)); width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #374151;"
			></div>
		</div>
		<!-- Zone bar: red · yellow · green — each third matches a SCORE_BANDS range -->
		<div class="flex h-2 w-full gap-[2px]">
			<div class="flex-1 rounded-l-full bg-red-400"></div>
			<div class="flex-1 bg-yellow-300"></div>
			<div class="flex-1 rounded-r-full bg-green-400"></div>
		</div>
		<!-- Scale labels -->
		<div class="mt-1.5 flex justify-between text-xs text-gray-400">
			<span>-100</span>
			<span>0</span>
			<span>100</span>
		</div>
	</div>
</div>
