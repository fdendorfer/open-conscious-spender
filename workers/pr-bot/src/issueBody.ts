export const BRAND_REQUEST_LABEL = 'brand-request';
export const DATA_CORRECTION_LABEL = 'data-correction';

const COUNT_MARKER = /<!--\s*ocs:count:(\d+)\s*-->/;

function keyMarker(kind: string, key: string): string {
	return `<!-- ocs:${kind}:${key} -->`;
}

/** Slug the bot deduplicates on. Falls back to the title so issues filed by hand on
 *  GitHub — which carry no marker — still match instead of spawning a duplicate. */
export function issueKey(
	issue: { title: string; body: string | null },
	kind: string,
	titlePrefix: string,
	slugify: (s: string) => string
): string | null {
	const marked = issue.body?.match(new RegExp(`<!--\\s*ocs:${kind}:([a-z0-9-]+)\\s*-->`));
	if (marked) return marked[1];
	if (!issue.title.startsWith(titlePrefix)) return null;
	return slugify(issue.title.slice(titlePrefix.length).replace(/\s*\(×\d+\)\s*$/, '')) || null;
}

export function readCount(body: string | null): number {
	const match = body?.match(COUNT_MARKER);
	return match ? Number(match[1]) : 1;
}

export function brandRequestTitle(name: string, count: number): string {
	return count > 1 ? `Brand request: ${name} (×${count})` : `Brand request: ${name}`;
}

export function brandRequestBody(name: string, slug: string, count: number): string {
	return [
		keyMarker(BRAND_REQUEST_LABEL, slug),
		`<!-- ocs:count:${count} -->`,
		'',
		`**${count} ${count === 1 ? 'request' : 'requests'} from the app.**`,
		'',
		`Someone scanned or searched for **${name}** and found no rating.`,
		'',
		'| | |',
		'| --- | --- |',
		`| Brand as submitted | ${name} |`,
		`| Proposed company id | \`${slug}\` |`,
		'',
		`Close this once \`data/companies/${slug}.json\` exists.`,
		'',
		'<sub>The count is app submissions, not distinct people — contributions are anonymous, so' +
			' treat it as a rough demand signal rather than a headcount.</sub>'
	].join('\n');
}

export function dataCorrectionTitle(companyName: string): string {
	return `Data correction: ${companyName}`;
}

export function dataCorrectionBody(companyId: string, companyName: string): string {
	return [
		keyMarker(DATA_CORRECTION_LABEL, companyId),
		'',
		`Reports of inaccurate data on **${companyName}** (\`${companyId}\`), submitted from its page in the app.`,
		'',
		`Each report is a comment below. Close this once \`data/companies/${companyId}.json\` is correct.`
	].join('\n');
}

export function reportComment(note: string, at: string): string {
	return [`**Reported ${at}**`, '', note.replace(/^/gm, '> ')].join('\n');
}
