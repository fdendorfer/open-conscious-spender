import { marked } from 'marked';
import scoringDoc from '../../../../docs/SCORING.md?raw';

// Runs at build time only (the route is prerendered), so `marked` never reaches
// the client bundle; the rendered HTML is serialised into the prerendered data.
// Wide code blocks scroll sideways, so keyboard users need to be able to focus them.
function focusablePre(html: string) {
	let n = 0;
	return html.replaceAll(
		'<pre>',
		() => `<pre tabindex="0" role="region" aria-label="Code example ${++n}">`
	);
}

export const load = () => ({
	html: focusablePre(marked.parse(scoringDoc, { async: false }) as string)
});
