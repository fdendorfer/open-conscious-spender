# Architecture

## Hosting

- **App**: Cloudflare Pages, deployed from this repo's `app/` (SvelteKit, static/PWA output).
- **PR bot**: a single Cloudflare Worker in `workers/pr-bot/`.
- Both comfortably fit Cloudflare's free tier at expected traffic (Pages: unlimited requests/500 builds-month free; Workers: 100k requests/day free) — no cost expected for the foreseeable future.

## Offline behaviour

The PWA has two independent caches, and the settings page (`/settings`) reports and clears both:

- **Dataset** — `bundle.json` in IndexedDB (`idb-keyval`), refreshed on a `meta.json` version mismatch.
- **App shell** — HTML/JS/CSS precached by the `vite-plugin-pwa` service worker.

Two constraints shape the config in `app/vite.config.ts`:

- `base`/`scope` are pinned to `'/'`. The generated `registerSW.js` resolves its script path against
  the *document*, so the default relative `./sw.js` asked for `/brand/sw.js` on a company page, got
  the SPA fallback HTML back, and failed registration on an unsupported MIME type.
- The root route is prerendered (`app/src/routes/+layout.ts`), because workbox's `navigateFallback`
  points at `/` and can only bind a handler to a URL that is actually in the precache manifest.
  `/brand/[slug]` opts back out — one page per company id is not enumerable at build time, so it
  falls back to the prerendered root and resolves its slug client-side.

## Icons

[Phosphor Icons](https://phosphoricons.com) ([MIT license](https://github.com/phosphor-icons/core/blob/main/LICENSE)) — wide enough concept coverage that no custom icon set is needed. Icon names are referenced per-category in `data/categories.json` as PascalCase component names, matching what `phosphor-svelte` exports: `Megaphone`, `HandFist`, `HardHat`, `Leaf`, `PawPrint`, `Scales`, `Coins`, `Bank`, `ShieldWarning`, `Buildings`, `ChartLineDown`.

The app resolves these through an explicit map in `app/src/lib/categoryIcons.ts`, not by dynamic lookup — so adding a category means adding its icon there too. `scripts/validate-dataset.mjs` cross-checks `categories.json` against that map, because an unknown icon otherwise fails silently as a blank space.

## Dataset versioning

The client needs a cheap way to know "is my cached dataset stale?" without re-downloading the full dataset just to check.

- A build step (`.github/workflows/build-dataset.yml`, on push to the default branch touching `data/**`) validates `data/**`, packages it into a single bundle, and writes `data/dist/meta.json`:
  ```json
  { "version": "<git short sha>", "builtAt": "<ISO timestamp>", "bytes": 46931, "companies": 77 }
  ```
  `bytes` (size of `bundle.json`) and `companies` let the settings page quote a download size
  before fetching the bundle — GitHub's raw host does not expose `Content-Length` to CORS reads.
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

`scripts/import-wikidata.mjs` fills in `wikidataId` and `parentId` from Wikidata. It is a maintainer tool, run by hand and reviewed as a normal PR — never part of the build, and never routed through the public PR-bot.

```sh
node scripts/import-wikidata.mjs                      # dry run, prints the proposed diff
node scripts/import-wikidata.mjs --write              # apply
node scripts/import-wikidata.mjs --write --only nestle,coop
```

Three rules keep the import from writing plausible-looking nonsense:

- **A hit must look like a legal entity** — either a known `P31` organisation type or a company-only claim (`P452` industry, `P1454` legal form, `P2139` revenue, `P1128` employees). The type list alone misses the long tail; Migros is a "cooperative federation".
- **Country has to agree** — a hit whose `P17` ISO code matches the company's `country` wins. "Sanitas" and "Raiffeisen" each name a larger foreign company than the Swiss one the dataset means. A match found in the wrong country is still reported, but printed under a "check these by hand" heading.
- **Only `P749` becomes `parentId`** — `P127` ("owned by") is populated with institutional shareholders and treasury stock, so importing it would make BlackRock the parent of half the dataset. A `P749` parent that isn't in the dataset is reported, not invented.

The script is idempotent: a company that already has a `wikidataId` is skipped, so rerunning it every few months only touches newly added entries.

## Contribution flow (PR bot)

Two kinds of contribution arrive through the Worker, and they get different destinations.

**Requests → issues.** "This brand isn't rated" and "this looks wrong" carry no reviewable diff, so a PR is the wrong container for them. A scan or search miss is one tap: name only, no category, no severity, no source. The Worker deduplicates against the open issue list and either opens an issue or bumps an existing one.

**Contributions → pull requests.** A sourced flag or a barcode mapping is a diff, gets reviewed as one, and keeps the existing branch-commit-PR path.

Splitting them is what makes the aisle case fast. Asking a shopper to pick a category and a severity was asking for research they can't do standing in a shop, and `toStoredFlag` discarded the trust component of it anyway — every app-submitted flag lands `unverified` and gets re-judged during review.

The Worker authenticates to GitHub via a fine-grained **Personal Access Token** (repo-scoped to just this repository, `contents:write` + `pull-requests:write` + `issues:write`), stored as a Worker secret (`wrangler secret put GITHUB_PAT`) — never exposed to the client.

### Deduplication

Keyed on `slugify(name)` for brands and on `companyId` for corrections, stored as an HTML marker comment in the issue body (`<!-- ocs:brand-request:nestle-waters -->`) and falling back to the issue title, so issues filed by hand on GitHub still match.

The key detail is *where* the key is read from. GitHub's search API is index-lagged by seconds to minutes, so two requests for the same brand a moment apart would both miss and open two issues. The Worker pages through `GET /issues?state=open&labels=…` instead, capped at 5 pages — which caps the open backlog it can see at 500 requests. Beyond that, duplicates slip through; that's the signal to start closing issues faster.

The list endpoint is *less* lagged than search but not strongly consistent either, as the first live smoke test proved: a second request a few seconds behind the first didn't see the issue the first had just created, and opened a duplicate. A third request 30s later deduplicated correctly. So the collision window is a few seconds wide, and two people scanning the same new product inside it get two issues, which a maintainer then closes as duplicates.

Closing that window entirely needs a strongly consistent slug → issue-number map that GitHub can't provide — a Durable Object, or a Worker KV entry written through on create (KV is itself eventually consistent, so it narrows the window rather than closing it). Untaken for now: the failure is a duplicate issue rather than lost data, and the rate is low at expected traffic.

### The request counter

Demand is tracked as a count in the issue title (`Brand request: Nestlé Waters (×12)`) and body, so the maintainer can sort the issue list by how many people asked.

It is **not** a GitHub 👍 reaction, which was the obvious choice and doesn't work: the bot acts as a single GitHub account, so its reaction count saturates at 1 no matter how many people submit. Reactions stay free for real GitHub users to upvote with independently.

Maintaining the count means a read-modify-write on the issue body, and GitHub offers no conditional write (no sha or ETag) for one — two requests in the same instant can drop an increment. That's tolerated here because the cost is one lost tick on a soft priority number. The same race was the reason not to keep a checklist of every request in one issue body, where a lost write means a request disappearing entirely.

The count is submissions, not people. Contributions are anonymous, so one determined person can inflate a brand. Fine as a rough signal; not a headcount.

### Rate limiting

Client-side, on-device: **10 PR submissions** and **30 requests** per rolling 24h, tracked in localStorage. Requests get the looser budget because one trip through a supermarket can easily miss ten brands.

This is a courtesy limit, not a control — clearing storage resets it. It was chosen over a server-side limit because that needs KV or a Durable Object, and the cheaper protections matter more:

- **The PAT's own budget** is the real shared resource: 5,000 REST calls/hour across *all* users of the app. A brand request spends 2-6 of them, mostly on the dedupe paging, which puts the practical ceiling near 1,000-2,500 requests/hour. The existence check deliberately goes through `raw.githubusercontent.com`, which doesn't count against it.
- **Cloudflare's free tier** caps the Worker at 100k requests/day.

Neither is close at expected traffic. If flooding does show up, a Cloudflare WAF rate-limiting rule at the zone edge is the first thing to reach for — no code, no state. Worth checking whether the Workers rate-limiting binding fits too; it avoids a KV round trip, but confirm its current availability and limits before depending on it.

## Licensing

- **Code**: MIT (`LICENSE`) — permissive, attribution via standard copyright notice.
- **Dataset** (`data/**`): CC BY 4.0 (`LICENSE-DATA.md`) — fully open, reuse requires credit.
