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

	const BAND_SURFACE: Record<Band, string> = {
		green: 'bg-green-50 dark:bg-green-950',
		yellow: 'bg-yellow-50 dark:bg-yellow-950',
		red: 'bg-red-50 dark:bg-red-950'
	};

	const BAND_TEXT: Record<Band, string> = {
		green: 'text-green-600 dark:text-green-400',
		yellow: 'text-yellow-600 dark:text-yellow-400',
		red: 'text-red-600 dark:text-red-400'
	};
</script>

<div class="flex flex-col items-center gap-1 rounded-xl p-6 text-center {BAND_SURFACE[band]}">
	<span class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-zinc-300"
		>Score</span
	>
	<span class="text-6xl font-bold {BAND_TEXT[band]}">{score}</span>
	<span class="text-sm font-medium {BAND_TEXT[band]}">{BAND_LABEL[band]}</span>
	<!-- Score gauge -->
	<div class="relative mt-3 w-full">
		<!-- Downward triangle marker positioned at the score -->
		<div class="relative mb-1 h-2">
			<div
				class="absolute bottom-0 text-gray-700 dark:text-zinc-300"
				style="left: clamp(0px, calc({gaugePercent}% - 4px), calc(100% - 8px)); width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid currentColor;"
			></div>
		</div>
		<!-- Zone bar: red · yellow · green — each third matches a SCORE_BANDS range -->
		<div class="flex h-2 w-full gap-[2px]">
			<div class="flex-1 rounded-l-full bg-red-400 dark:bg-red-500"></div>
			<div class="flex-1 bg-yellow-300 dark:bg-yellow-500"></div>
			<div class="flex-1 rounded-r-full bg-green-400 dark:bg-green-500"></div>
		</div>
		<!-- Scale labels -->
		<div class="mt-1.5 flex justify-between text-xs text-gray-400 dark:text-zinc-400">
			<span>-100</span>
			<span>0</span>
			<span>100</span>
		</div>
	</div>
</div>
