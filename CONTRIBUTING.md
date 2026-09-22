# Contributing

Two very different kinds of contribution live in this repo, and they have different bars.

- **Dataset** (`data/**`) — company entries, flags, barcode mappings. Anyone can add these, and most contributions are this kind. Sourcing is the bar.
- **Code** (`app/`, `workers/`, `scripts/`) — the PWA, the PR bot, the build pipeline.

By contributing you agree your work is licensed under [MIT](LICENSE) for code and [CC BY 4.0](LICENSE-DATA.md) for dataset entries.

## Contributing data

The easiest path is the app itself: search or scan a company, hit "Suggest a flag", and the PR bot opens a pull request for you. No account, no git, no local checkout.

To do it by hand, add or edit a file under `data/companies/<id>.json` and open a PR. Before pushing:

```sh
node scripts/validate-dataset.mjs
```

Never edit `data/dist/`. It is generated, and CI rebuilds and commits it after a merge, so hand edits only create conflicts.

### What makes a good flag

- **Source it.** A flag without a `sourceUrl` can still be merged, but it stays `"status": "unverified"` and counts for only 0.6× in the score. Reporting from an established outlet, a regulator's decision, a court filing or a company's own disclosure all work. A forum post or a social media thread does not.
- **Describe the conduct, not the verdict.** "Fined €X by <regulator> in <year> for <conduct>" is checkable. "Terrible company" is not.
- **Pick the narrowest true severity.** `systemic` is a 5× multiplier and means the conduct is structural to how the company operates, not a single lapse.
- **Flag the company that did it.** Ownership is a separate field; putting a subsidiary's conduct on the parent is not how the graph is meant to work.
- **Positive flags count too.** Set `"polarity": "positive"` and the same sourcing bar applies.

Flags submitted through the app always land as `unverified` regardless of whether a source was given, because an anonymous submitter's link is not itself proof. A maintainer promotes it to `sourced` after checking it during review.

`status: "sourced"` requires a `sourceUrl`; the validator enforces that, since the status drives the confidence multiplier.

### Category weights and the score

Weights live in `data/categories.json` and the formula is documented in [`docs/SCORING.md`](docs/SCORING.md). Changing a weight reprices every company at once, so open an issue to discuss it before a PR. Adding a new category needs an entry in `categories.json` and a matching icon in `app/src/lib/categoryIcons.ts` — the validator fails the build if the icon is missing, because an unknown one otherwise renders as a blank space.

## Contributing code

```sh
cd app && pnpm install
pnpm dev
```

Before opening a PR:

```sh
pnpm lint    # prettier --check + eslint
pnpm check   # svelte-check
pnpm build
```

CI runs all three on every PR touching `app/**` or `workers/**`, plus a typecheck for the worker.

### Conventions

- **pnpm, not npm.** Both packages carry a `pnpm-lock.yaml`. Note `pnpm deploy` is pnpm's own subcommand, so the worker's deploy script needs `pnpm run deploy`.
- **Commit messages**: [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Put the reasoning in the body.
- **Comments**: default to none. Write one only when naming and structure genuinely cannot carry the meaning, and keep it to two lines. Rationale belongs in the commit message.
- **Svelte 5 runes** are enforced project-wide (see `app/vite.config.ts`).
- `app/src/lib/scoring.ts` implements `docs/SCORING.md`. Change both together or neither.

### TypeScript version

`workers/pr-bot` is on TypeScript 7. `app` is pinned to TypeScript 6 on purpose: `typescript-eslint` and `svelte-check` do not support TS 7 yet, and moving the app forward today would mean giving up typed linting. Revisit once `typescript-eslint` ships TS 7 support.

## Review

Every dataset PR is reviewed by a maintainer before merge. The most common reasons a flag is sent back are an unusable source, a severity that does not match the described conduct, and conduct attributed to the wrong legal entity.
