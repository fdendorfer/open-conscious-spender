<script lang="ts">
	import { marked } from 'marked';
	import scoringDoc from '../../../../docs/SCORING.md?raw';

	const html = marked.parse(scoringDoc, { async: false }) as string;
</script>

<svelte:head>
	<title>Scoring methodology — Conscious</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-10">
	<div class="scoring-doc">
		{@html html}
	</div>
</main>

<style>
	.scoring-doc :global(h1) {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}
	.scoring-doc :global(h2) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 2rem;
		margin-bottom: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid #f3f4f6;
	}
	.scoring-doc :global(h2:first-of-type) {
		border-top: none;
		padding-top: 0;
	}
	.scoring-doc :global(p) {
		font-size: 0.875rem;
		color: #4b5563;
		line-height: 1.6;
		margin-bottom: 0.75rem;
	}
	.scoring-doc :global(ul) {
		font-size: 0.875rem;
		color: #4b5563;
		margin: 0.5rem 0 1rem 1.25rem;
		list-style: disc;
	}
	.scoring-doc :global(li) {
		margin-bottom: 0.35rem;
		line-height: 1.5;
	}
	.scoring-doc :global(code) {
		font-family: ui-monospace, monospace;
		background: #f3f4f6;
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-size: 0.8125rem;
	}
	.scoring-doc :global(pre) {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}
	.scoring-doc :global(pre code) {
		background: none;
		padding: 0;
	}
	.scoring-doc :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
		margin-bottom: 1rem;
	}
	.scoring-doc :global(th),
	.scoring-doc :global(td) {
		border: 1px solid #e5e7eb;
		padding: 0.5rem 0.75rem;
		text-align: left;
	}
	.scoring-doc :global(th) {
		background: #f9fafb;
		font-weight: 500;
		color: #6b7280;
	}
	.scoring-doc :global(strong) {
		font-weight: 600;
		color: #111827;
	}
	.scoring-doc :global(hr) {
		border: none;
		border-top: 1px solid #e5e7eb;
		margin: 2rem 0;
	}
	.scoring-doc :global(a) {
		color: #2563eb;
		text-decoration: underline;
	}
</style>
