<script lang="ts">
	import { LOGO_PATHS, LOGO_VIEWBOX } from '$lib/logoArtwork';

	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	class={className}
	xmlns="http://www.w3.org/2000/svg"
	viewBox={LOGO_VIEWBOX}
	fill="currentColor"
	aria-hidden="true"
>
	{#each LOGO_PATHS as d (d)}
		<path {d} />
	{/each}
</svg>
