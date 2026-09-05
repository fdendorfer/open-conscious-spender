<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<main
	class="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6 text-center"
>
	<h1 class="text-lg font-medium">Open Conscious Spender</h1>
	<p class="text-sm text-gray-500">Scan a barcode, see a company's red flags, decide in seconds.</p>
	<a class="rounded-xl bg-gray-900 px-6 py-3 font-medium text-white" href={resolve('/scan')}>
		Start scanning
	</a>
</main>
