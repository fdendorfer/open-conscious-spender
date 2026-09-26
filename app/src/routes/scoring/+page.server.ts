import { marked } from 'marked';
import scoringDoc from '../../../../docs/SCORING.md?raw';

// Runs at build time only (the route is prerendered), so `marked` never reaches
// the client bundle; the rendered HTML is serialised into the prerendered data.
export const load = () => ({ html: marked.parse(scoringDoc, { async: false }) as string });
