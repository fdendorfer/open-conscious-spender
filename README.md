# Open Conscious Spender (OCS)

A progressive web app for instant, low-reading ethical-shopping lookups: scan a barcode in-store, get an icon-based read on the company's red flags, decide in seconds.

Inspired by [consciousspend.com](https://consciousspend.com), with three differences:
- **Public contributions** — anyone can request a brand in one tap, or open a dataset PR from the app if they have a source.
- **Brand-to-owner lookup** — brands map to the company that owns them, so scanning a product tells you who you're actually buying from. Ownership is shown for context; it never moves a flag between companies.
- **Quick-lookup first** — result screen is icons + a score, not paragraphs.

## Status

Working prototype. The PWA (search, barcode scan, company/brand pages, score breakdown), the dataset pipeline, and the anonymous PR-bot Worker are all implemented; the dataset currently seeds 76 companies, weighted toward the Swiss market.

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
node scripts/import-wikidata.mjs       # dry-run ownership/QID import (maintainers)
```

Edits to `data/**` are validated on every pull request. `data/dist/` is generated — CI rebuilds and commits it after a merge, so changing it by hand only creates conflicts.

## Stack decisions

- **Frontend**: SvelteKit (small bundle, compiles away the framework, pairs well with `@vite-pwa/sveltekit` for offline caching)
- **Hosting**: Cloudflare Pages (app) + Cloudflare Workers (PR-bot function) — comfortably within free tier at expected traffic
- **Dataset**: JSON in `data/`, versioned via a small `meta.json` (see `docs/ARCHITECTURE.md`)
- **Contribution flow**: local-first (IndexedDB), then a "submit as PR" button calls a Worker that opens the PR using a GitHub PAT — no contributor login needed
- **Licensing**: code under MIT (`LICENSE`), dataset under CC BY 4.0 (`LICENSE-DATA.md`) — fully open, attribution required

## Docs

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to add a company or flag, and what makes a source usable
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — hosting, data versioning, validation, PR-bot + rate limiting
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's next and the decisions already settled
- [`docs/SCORING.md`](docs/SCORING.md) — the extendable flag → score formula
- [`workers/pr-bot/README.md`](workers/pr-bot/README.md) — contribution endpoints and Worker setup
- `data/categories.json` — the flag-category taxonomy and its default weights
