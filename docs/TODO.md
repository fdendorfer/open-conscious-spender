# TODO

Open work, grouped by what it blocks. `docs/ROADMAP.md` holds the longer-term direction and the decisions already settled; this file is the short list of things that are unfinished, unverified, or known-broken.

## Untested

- [ ] **The PR-bot Worker end to end.** `workers/pr-bot/test/` covers every route against a fake GitHub, but no test submits from the app to a deployed Worker.
- [ ] **`scripts/import-wikidata.mjs`.** Verified by hand on the live API, never by a test. The three matching guards (organisation claim, country agreement, `P749`-only) deserve fixtures.
- [ ] **Real screen-reader pass.** Accessibility audit findings are fixed and axe is clean, but nothing has been tried with NVDA, VoiceOver or TalkBack.
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
