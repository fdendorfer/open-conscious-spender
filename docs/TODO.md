# TODO

Open work, grouped by what it blocks. `docs/ROADMAP.md` holds the longer-term direction and the decisions already settled; this file is the short list of things that are unfinished, unverified, or known-broken.

## Blocking a real deploy

- [ ] **Push the branch.** `main` is 9 commits ahead of `origin/main`. Nothing here is live, and the dataset CI (`build-dataset.yml`) only rebuilds `data/dist/` on push, so the Wikidata ids are not in the shipped bundle yet.
- [ ] **Set `PUBLIC_PR_BOT_URL`.** It is unset, so `PR_BOT_URL` is `''` and every contribution and rating request fails at submit time. The Worker in `workers/pr-bot/` also has to be deployed and its secrets set (see its README).
- [ ] **Seed `data/products/barcode-overrides.json`.** It ships empty, so *no* barcode resolves without a connection, while the offline copy in the scanner implies some do. One override for a common Swiss product would make the offline path real.

## Known bugs and rough edges

- [ ] **The deployed bundle has no `version` key** (built before the field moved inside `bundle.json`), so `refreshIfStale()` never matches and clients re-download ~46 KB on every launch. `normalizeDataset()` now falls back to `meta.json`'s version, and the next CI rebuild fixes it at the source.
- [ ] **`registerSW.js` 404s in `pnpm dev`.** Harmless — `vite-plugin-pwa` only emits it in a production build — but it puts a permanent error in the dev console. Enable `devOptions` if it gets annoying.
- [ ] **The trip basket has no empty-state copy.** It renders nothing at all before the first scan, so `/shopping` looks the same whether or not the feature exists.
- [ ] **Request-form buttons are visually cramped.** "I already have a source" and "Cancel" sit on top of each other with no separation.

## Untested

- [ ] **The real camera scan path.** Every scanner test drives the manual-barcode fallback, because headless Chromium has no camera. A decode test needs `--use-fake-device-for-media-stream` with a generated barcode frame, or a `BarcodeDetector` stub.
- [ ] **The PR-bot Worker.** No tests at all: neither the issue-dedup path nor the PR path, and neither is exercised end to end from the app.
- [ ] **Rune-based stores** (`scanTrip`, `shoppingMode`, `searchHistory`, `theme`). Covered only through the browser; unit tests would need the Svelte vitest plugin.
- [ ] **`scripts/import-wikidata.mjs`.** Verified by hand on the live API, never by a test. The three matching guards (organisation claim, country agreement, `P749`-only) deserve fixtures.
- [ ] **Accessibility beyond the combobox.** No axe pass, no keyboard-only walk of the scanner overlay or the contribution forms.
- [ ] **Lighthouse / bundle budget.** Never measured, so there is no number to regress against.

## Data

- [ ] **76 companies is thin** for a real basket. See the Roadmap's dataset-breadth item.
- [ ] **No company has a `parentId`.** The Wikidata import found `P749` parents for `carlsberg`, `h-and-m` and `roche`, but all three are companies the dataset does not have yet. Adding the parent first, then rerunning, fills the chain.
- [ ] **9 companies have no `wikidataId`:** bellefontaine, dermafora, fleischtrocknerei-churwalden, goba, innoprax, luzern-laboratories, sponser-sport-food, ultrasun, valmont. Small Swiss firms, most likely absent from Wikidata.
- [ ] **`concordia` and `le-parfait` are deliberately unset.** They matched a Canadian university and a Philippine sugar mill; the wrong-country report caught both.

## Wanted, not built

Each has a failing-by-design spec in `app/e2e/not-yet-built.spec.ts` — unskip the `test.fixme` when the feature lands.

- [ ] Contribute a barcode → company mapping from a scan miss. The Worker endpoint (`/submit/barcode`) and the `barcode` draft kind already exist; no screen reaches them.
- [ ] Category-aware alternatives ("buy this instead"), which needs a product category on companies.
- [ ] Trip history beyond the current 4h trip.
- [ ] Flag decay: `decayMultiplier` is read by the scoring formula but nothing ever sets it.
- [ ] Share or export a trip.
- [ ] Filter the ranking by flag category.
- [ ] A dataset-freshness line on the settings page ("updated 3 days ago").
