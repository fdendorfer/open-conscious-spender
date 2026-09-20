# Open Conscious Spender (OCS)

A progressive web app for instant, low-reading ethical-shopping lookups: scan a barcode in-store, get an icon-based read on the parent company's red flags, decide in seconds.

Inspired by [consciousspend.com](https://consciousspend.com), with three differences:
- **Public contributions** — anyone can add a company/flag; a one-click button opens a PR against this repo's dataset.
- **Parent-company focus** — ownership graph so a flag on a subsidiary surfaces on the brand you're actually holding.
- **Quick-lookup first** — result screen is icons + a score, not paragraphs.

## Status

Working prototype. The PWA (search, barcode scan, company/brand pages, score breakdown), the dataset pipeline, and the anonymous PR-bot Worker are all implemented; the dataset currently seeds 77 companies, weighted toward the Swiss market.

## Repo layout

```
data/            # the canonical dataset (companies, categories, barcode overrides) — PRs land here
  dist/          # generated bundle + meta.json, committed by CI — never edit by hand
docs/            # architecture and scoring docs
scripts/         # dataset validation + bundle build
app/             # SvelteKit PWA
workers/pr-bot/  # Cloudflare Worker that opens contribution PRs
```

One repo houses both the app and the dataset for now.

## Working on it

```sh
cd app && pnpm install && pnpm dev     # run the PWA

node scripts/validate-dataset.mjs      # check data/** against the schema
node scripts/build-dataset.mjs         # regenerate data/dist/ (CI does this on push)
```

Edits to `data/**` are validated on every pull request. `data/dist/` is generated — CI rebuilds and commits it after a merge, so changing it by hand only creates conflicts.

## Stack decisions

- **Frontend**: SvelteKit (small bundle, compiles away the framework, pairs well with `@vite-pwa/sveltekit` for offline caching)
- **Hosting**: Cloudflare Pages (app) + Cloudflare Workers (PR-bot function) — comfortably within free tier at expected traffic
- **Dataset**: JSON in `data/`, versioned via a small `meta.json` (see `docs/ARCHITECTURE.md`)
- **Contribution flow**: local-first (IndexedDB), then a "submit as PR" button calls a Worker that opens the PR using a GitHub PAT — no contributor login needed
- **Licensing**: code under MIT (`LICENSE`), dataset under CC BY 4.0 (`LICENSE-DATA.md`) — fully open, attribution required

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — hosting, data versioning, validation, PR-bot + rate limiting
- [`docs/SCORING.md`](docs/SCORING.md) — the extendable flag → score formula
- [`workers/pr-bot/README.md`](workers/pr-bot/README.md) — contribution endpoints and Worker setup
- `data/categories.json` — the flag-category taxonomy and its default weights
