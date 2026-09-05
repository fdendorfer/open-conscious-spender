<script lang="ts">
	import { Megaphone, HandFist, HardHat, Leaf, PawPrint, Scales } from 'phosphor-svelte';
	import categories from '../../../data/categories.json';

	// Placeholder result until real barcode lookup + dataset wiring exists.
	// Demonstrates the "glance, don't read" result screen: icons for matched
	// flag categories, score as secondary detail.
	const iconByCategoryId: Record<string, typeof Megaphone> = {
		'boycott-conflict': Megaphone,
		'human-rights': HandFist,
		'labor-rights': HardHat,
		environment: Leaf,
		'animal-welfare': PawPrint,
		corruption: Scales
	};

	const demoFlaggedCategoryIds = ['labor-rights', 'environment'];
	const demoScore = 42;
	const band = demoScore < 30 ? 'green' : demoScore < 65 ? 'yellow' : 'red';

	const flagged = categories.filter((c) => demoFlaggedCategoryIds.includes(c.id));
</script>

<main class="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6">
	<h1 class="text-lg font-medium">Open Conscious Spender</h1>

	<div
		class="flex flex-col items-center gap-4 rounded-2xl p-8"
		class:bg-green-100={band === 'green'}
		class:bg-yellow-100={band === 'yellow'}
		class:bg-red-100={band === 'red'}
	>
		<div class="flex gap-4">
			{#each flagged as category (category.id)}
				{@const Icon = iconByCategoryId[category.id]}
				<div class="flex flex-col items-center gap-1" title={category.name}>
					<Icon size={40} weight="fill" />
				</div>
			{/each}
		</div>
		<span class="text-3xl font-semibold">{demoScore}</span>
	</div>

	<p class="text-center text-sm text-gray-500">
		Placeholder result — barcode scan, real dataset, and scoring wiring come next.
	</p>
</main>
