# app

The Open Conscious Spender PWA. SvelteKit, deployed to Cloudflare Pages.

## Developing

```sh
npm install
npm run dev
```

## Environment

`PUBLIC_PR_BOT_URL` — base URL of the deployed `workers/pr-bot` Worker. Without
it set, everything works (scanning, lookup, local drafts) except the final
"submit as PR" step, which shows a "not configured yet" message. Set it as a
Cloudflare Pages environment variable, or locally in an untracked `.env`
file (`PUBLIC_PR_BOT_URL=http://localhost:8787` against `wrangler dev`).

## Building / checking

```sh
npm run build   # also runs `wrangler types --check`
npm run check   # svelte-check
npm run lint    # prettier --check + eslint
```

## Key modules

- `src/lib/dataset.ts` — fetches/caches the dataset bundle built by `scripts/build-dataset.mjs`
- `src/lib/scoring.ts` — implements `docs/SCORING.md`; keep both in sync
- `src/lib/lookup.ts` + `src/lib/openFoodFacts.ts` — barcode → brand → company resolution
- `src/lib/barcodeScanner.ts` — camera-based barcode detection
- `src/lib/contribute.ts` — local drafts, on-device rate limiting, submission to the PR bot
- `src/routes/scan/` — the actual scan → result → contribute flow
