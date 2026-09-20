# Architecture

## Hosting

- **App**: Cloudflare Pages, deployed from this repo's `app/` (SvelteKit, static/PWA output).
- **PR bot**: a single Cloudflare Worker in `workers/pr-bot/`.
- Both comfortably fit Cloudflare's free tier at expected traffic (Pages: unlimited requests/500 builds-month free; Workers: 100k requests/day free) — no cost expected for the foreseeable future.

## Icons

[Phosphor Icons](https://phosphoricons.com) ([MIT license](https://github.com/phosphor-icons/core/blob/main/LICENSE)) — wide enough concept coverage that no custom icon set is needed. Icon names are referenced per-category in `data/categories.json` as PascalCase component names, matching what `phosphor-svelte` exports: `Megaphone`, `HandFist`, `HardHat`, `Leaf`, `PawPrint`, `Scales`, `Coins`, `Bank`, `ShieldWarning`, `Buildings`, `ChartLineDown`.

The app resolves these through an explicit map in `app/src/lib/categoryIcons.ts`, not by dynamic lookup — so adding a category means adding its icon there too. `scripts/validate-dataset.mjs` cross-checks `categories.json` against that map, because an unknown icon otherwise fails silently as a blank space.

## Dataset versioning

The client needs a cheap way to know "is my cached dataset stale?" without re-downloading the full dataset just to check.

- A build step (`.github/workflows/build-dataset.yml`, on push to the default branch touching `data/**`) validates `data/**`, packages it into a single bundle, and writes `data/dist/meta.json`:
  ```json
  { "version": "<git short sha>", "builtAt": "<ISO timestamp>" }
  ```
- The PWA fetches `meta.json` (tiny) whenever it has connectivity, compares `version` against what it has cached in IndexedDB, and only re-fetches the full bundle on a mismatch.
- No semantic versioning needed — the git commit SHA is already a unique, ordered-enough identifier, and it makes "what changed" traceable straight back to the commit/PR history.

## Dataset validation

`scripts/validate-dataset.mjs` is the gate between contributed JSON and the shipped bundle. It runs on every pull request touching `data/**` (`.github/workflows/validate-dataset.yml`) and again before the bundle is built, so a bad entry can't reach clients.

Errors (build fails):

- Schema conformance against `Company` / `StoredFlag` in `app/src/lib/dataset.ts` — required fields, enum values for `severity` / `status` / `polarity`, `YYYY-MM-DD` dates, http(s)-or-null source URLs.
- Company `id` is kebab-case and matches its filename; ids are unique.
- `parentId` resolves to an existing company, isn't self-referential, and forms no ownership cycle — `ownershipChain()` walks this graph and would otherwise loop.
- Flag `category` exists in `categories.json`; category `icon` exists in `CATEGORY_ICONS`.
- Barcode override keys are valid GTIN lengths and map to existing companies.
- A flag marked `sourced` carries a `sourceUrl` — the status is the app's confidence multiplier, so an unsourced "sourced" flag inflates the score.

Warnings (advisory):

- Unknown fields — almost always a typo, since the app silently drops them.
- A name/alias/brand claimed by two companies, which makes brand lookup pick one arbitrarily.
- GTIN check-digit failures and future-dated flags.

## Wikidata import

Planned, not yet implemented. Ownership is currently filled in by hand: 7 of 77 companies carry a `parentId`, and no company has a `wikidataId` yet.

- `scripts/import-wikidata.mjs` — a standalone Node script, run manually (`node scripts/import-wikidata.mjs`), not part of the build pipeline.
- Queries Wikidata's SPARQL endpoint for ownership relations (`P127` owned by / `P1830` owner of, etc.) for the companies already present in `data/companies/`, and writes/updates their `parentId` / `wikidataId` fields.
- Rerunnable idempotently — safe to run every few months as a maintenance task, changes reviewed like any other PR before merge (this is a maintainer action, not routed through the public PR-bot).

## Contribution flow (PR bot)

1. User adds a company/flag locally in the PWA → stored in IndexedDB.
2. "Submit as PR" button sends the draft entry to the Worker.
3. Worker authenticates to GitHub via a fine-grained **Personal Access Token** (repo-scoped to just this repository, `contents:write` + `pull-requests:write`), stored as a Worker secret (`wrangler secret put GITHUB_PAT`) — never exposed to the client.
4. Worker creates a branch, commits the new/changed JSON file, opens a PR for maintainer review.

### Rate limiting

Client-side, on-device limit: **10 submissions per rolling 24h**, tracked in IndexedDB/localStorage on the device. Chosen over a global server-side limit (e.g. 50/day via Workers KV/Durable Object counter) because it requires no server-side state at all — trivially cheaper to build and operate, and sufficient given abuse isn't currently a major concern. Revisit if abuse patterns emerge (a global limit can be added later without changing the client contract).

## Licensing

- **Code**: MIT (`LICENSE`) — permissive, attribution via standard copyright notice.
- **Dataset** (`data/**`): CC BY 4.0 (`LICENSE-DATA.md`) — fully open, reuse requires credit.
