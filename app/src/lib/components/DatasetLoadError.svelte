<script lang="ts">
	import { ArrowClockwise, WifiSlash } from 'phosphor-svelte';

	let { onRetry }: { onRetry: () => void } = $props();
</script>

<div
	class="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 p-6 text-center dark:border-zinc-700"
	role="alert"
>
	<WifiSlash size={28} class="text-gray-400 dark:text-zinc-400" />
	<p class="text-sm text-gray-600 dark:text-zinc-300">
		The dataset couldn't be downloaded. Once it has loaded on this device, it stays available
		offline.
	</p>
	<button
		class="flex cursor-pointer items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
		onclick={onRetry}
	>
		<ArrowClockwise size={16} />
		Try again
	</button>
</div>
