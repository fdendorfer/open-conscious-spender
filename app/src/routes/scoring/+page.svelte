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
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- docs/SCORING.md is a repo file, not user input -->
		{@html html}
	</div>
</main>

<style>
	.scoring-doc {
		--doc-rule: #f3f4f6;
		--doc-border: #e5e7eb;
		--doc-muted: #4b5563;
		--doc-faint: #6b7280;
		--doc-surface: #f9fafb;
		--doc-inline: #f3f4f6;
		--doc-strong: #111827;
		--doc-link: #2563eb;
	}

	:global(html.dark) .scoring-doc {
		--doc-rule: #27272a;
		--doc-border: #27272a;
		--doc-muted: #a1a1aa;
		--doc-faint: #a1a1aa;
		--doc-surface: #18181b;
		--doc-inline: #27272a;
		--doc-strong: #f4f4f5;
		--doc-link: #60a5fa;
	}

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
		border-top: 1px solid var(--doc-rule);
	}
	.scoring-doc :global(h2:first-of-type) {
		border-top: none;
		padding-top: 0;
	}
	.scoring-doc :global(p) {
		font-size: 0.875rem;
		color: var(--doc-muted);
		line-height: 1.6;
		margin-bottom: 0.75rem;
	}
	.scoring-doc :global(ul) {
		font-size: 0.875rem;
		color: var(--doc-muted);
		margin: 0.5rem 0 1rem 1.25rem;
		list-style: disc;
	}
	.scoring-doc :global(li) {
		margin-bottom: 0.35rem;
		line-height: 1.5;
	}
	.scoring-doc :global(code) {
		font-family: ui-monospace, monospace;
		background: var(--doc-inline);
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-size: 0.8125rem;
	}
	.scoring-doc :global(pre) {
		background: var(--doc-surface);
		border: 1px solid var(--doc-border);
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
		border: 1px solid var(--doc-border);
		padding: 0.5rem 0.75rem;
		text-align: left;
	}
	.scoring-doc :global(th) {
		background: var(--doc-surface);
		font-weight: 500;
		color: var(--doc-faint);
	}
	.scoring-doc :global(strong) {
		font-weight: 600;
		color: var(--doc-strong);
	}
	.scoring-doc :global(hr) {
		border: none;
		border-top: 1px solid var(--doc-border);
		margin: 2rem 0;
	}
	.scoring-doc :global(a) {
		color: var(--doc-link);
		text-decoration: underline;
	}
</style>
