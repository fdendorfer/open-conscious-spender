# Open Conscious Spender (OCS)

A progressive web app for instant, low-reading ethical-shopping lookups: scan a barcode in-store, get an icon-based read on the parent company's red flags, decide in seconds.

Inspired by [consciousspend.com](https://consciousspend.com), with three differences:
- **Public contributions** — anyone can add a company/flag; a one-click button opens a PR against this repo's dataset.
- **Parent-company focus** — ownership graph so a flag on a subsidiary surfaces on the brand you're actually holding.
- **Quick-lookup first** — result screen is icons + a score, not paragraphs.

## Status

Planning stage. See `docs/` for the decisions made so far.

## Repo layout (planned)

```
data/            # the canonical dataset (companies, categories, ownership) — PRs land here
docs/            # architecture, scoring, contribution docs
scripts/         # maintenance scripts (e.g. Wikidata import)
app/             # SvelteKit PWA (not yet scaffolded)
workers/         # Cloudflare Worker(s), e.g. the anonymous PR bot (not yet scaffolded)
```

One repo houses both the app and the dataset for now.

## Stack decisions

- **Frontend**: SvelteKit (small bundle, compiles away the framework, pairs well with `@vite-pwa/sveltekit` for offline caching)
- **Hosting**: Cloudflare Pages (app) + Cloudflare Workers (PR-bot function) — comfortably within free tier at expected traffic
- **Dataset**: JSON in `data/`, versioned via a small `meta.json` (see `docs/ARCHITECTURE.md`)
- **Contribution flow**: local-first (IndexedDB), then a "submit as PR" button calls a Worker that opens the PR using a GitHub PAT — no contributor login needed
- **Licensing**: code under MIT (`LICENSE`), dataset under CC BY 4.0 (`LICENSE-DATA.md`) — fully open, attribution required

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — hosting, data versioning, Wikidata import, PR-bot + rate limiting
- [`docs/SCORING.md`](docs/SCORING.md) — the extendable flag → score formula
- `data/categories.json` — seed flag-category taxonomy
