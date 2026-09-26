# Roadmap

Tracking doc for future improvements and the decisions behind them. One line each.

## Next

- **Dataset breadth** — 76 companies misses most real baskets; bulk-seed the top Swiss and EU grocery owners before promoting the app anywhere.
- **Barcode override coverage** — every `unknown-brand` result is a candidate override, so mine the issue tracker for repeat scans.
- **Category-aware alternatives** — "buy this instead" needs a product category on companies, which the schema does not have yet.
- **Trip history** — the scan trip resets after a 4h gap; keeping past trips would need a real storage budget decision first.
- **Flag decay** — `decayMultiplier` is wired through scoring but nothing sets it; decide on an age curve before the dataset grows old.

## Decisions

- **Ownership comes from Wikidata, not hand-entry** — `scripts/import-wikidata.mjs` proposes `parentId`/`wikidataId` and a maintainer reviews the diff; it never runs in CI.
- **Open Facts sources are queried in parallel** — four sequential lookups cost up to four round trips while someone stands in an aisle.
- **Resolved barcodes are cached on device** — a re-scan of a product seen before resolves offline and instantly.
- **Requests become issues, contributions become PRs** — a brand request carries no reviewable diff (see `docs/ARCHITECTURE.md`).
- **Score is bidirectional and saturating** — see `docs/SCORING.md`; positives and negatives saturate separately so one direction cannot be drowned out.

## Won't do (for now)

- **Contributor accounts** — the PR-bot's anonymous path is what makes an in-aisle contribution one tap.
- **Server-side search** — the whole dataset is ~50 KB and must work offline.
