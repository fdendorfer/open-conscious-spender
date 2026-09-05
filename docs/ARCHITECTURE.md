# Architecture

## Hosting

- **App**: Cloudflare Pages, deployed from this repo's `app/` (SvelteKit, static/PWA output).
- **PR bot**: a single Cloudflare Worker in `workers/pr-bot/`.
- Both comfortably fit Cloudflare's free tier at expected traffic (Pages: unlimited requests/500 builds-month free; Workers: 100k requests/day free) — no cost expected for the foreseeable future.

## Icons

[Phosphor Icons](https://phosphoricons.com) ([MIT license](https://github.com/phosphor-icons/core/blob/main/LICENSE)) — wide enough concept coverage that no custom icon set is needed. Icon names are referenced per-category in `data/categories.json` (verified to exist in the Phosphor `regular` weight as of writing: `megaphone`, `hand-fist`, `hard-hat`, `leaf`, `paw-print`, `scales`, `coins`, `bank`, `shield-warning`, `buildings`).

## Dataset versioning

The client needs a cheap way to know "is my cached dataset stale?" without re-downloading the full dataset just to check.

- A build step (GitHub Action, on push to `main` touching `data/**`) packages `data/**` into a single bundle and writes `data/dist/meta.json`:
  ```json
  { "version": "<git short sha>", "builtAt": "<ISO timestamp>" }
  ```
- The PWA fetches `meta.json` (tiny) whenever it has connectivity, compares `version` against what it has cached in IndexedDB, and only re-fetches the full bundle on a mismatch.
- No semantic versioning needed — the git commit SHA is already a unique, ordered-enough identifier, and it makes "what changed" traceable straight back to the commit/PR history.

## Wikidata import

- `scripts/import-wikidata.mjs` — a standalone Node script, run manually (`npm run import:wikidata`), not part of the build pipeline.
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
