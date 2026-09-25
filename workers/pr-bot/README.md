# PR bot

Cloudflare Worker that turns an anonymous, on-device contribution into either a GitHub issue or a pull request against this repo's `data/`. See `docs/ARCHITECTURE.md` for the design rationale.

## Endpoints

All `POST`, JSON body, CORS-restricted to `ALLOWED_ORIGIN`.

### Issues — asking for work

- `POST /request/brand` — `{ name, gtin?, note? }` → `{ issueUrl, requestCount }`
- `POST /report/inaccuracy` — `{ companyId, note }` → `{ issueUrl }`

Both deduplicate. A brand request looks for an open `brand-request` issue for `slugify(name)`; finding one, it bumps a counter in the title and body instead of opening a second issue. An inaccuracy report appends a comment to the company's open `data-correction` issue.

Deduplication reads the open issue list rather than the search API, which is index-lagged enough to let duplicates through. The key is a marker comment in the issue body, falling back to the title so issues filed by hand on GitHub still match.

### Pull requests — supplying content

- `POST /submit/company` — `{ name, country?, flags: [{ category, description, severity, sourceUrl? }] }` (1-5 flags)
- `POST /submit/flag` — `{ companyId, flag: { category, description, severity, sourceUrl? } }`
- `POST /submit/barcode` — `{ gtin, companyId }`

Every flag category is validated live against the repo's own `data/categories.json` — no separate category list to keep in sync. Every submission lands as its own PR for maintainer review; flags always start as `status: "unverified"` regardless of whether a source URL was given, since an anonymous submitter's link isn't itself proof.

## Setup

```sh
pnpm install
pnpm exec wrangler secret put GITHUB_PAT
```

Use a **fine-grained personal access token** scoped to only this repository, with:
- Contents: Read and write
- Pull requests: Read and write
- Issues: Read and write

Nothing broader — this token lives in a public-facing Worker's secret store.

Create the two labels the bot files under before first use, so they get sensible colours and descriptions rather than whatever the API assigns:

```sh
gh label create brand-request  -d "Someone asked for a company that isn't rated yet"
gh label create data-correction -d "Something in the dataset is reported as wrong"
```

## Local dev

```sh
pnpm dev
```

Runs against the real GitHub API for reads (categories, existing files) but any write call will fail without a real `GITHUB_PAT` bound locally (`wrangler dev` reads secrets from `.dev.vars`, which is gitignored — create one with `GITHUB_PAT=...` to test the full write path).

## Deploy

```sh
pnpm run deploy
```

`run` is not optional here: `pnpm deploy` is pnpm's own built-in subcommand.

Requires `wrangler login` once per machine.
