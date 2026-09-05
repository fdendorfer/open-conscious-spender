# PR bot

Cloudflare Worker that turns an anonymous, on-device contribution draft into a real GitHub pull request against this repo's `data/`. See `docs/ARCHITECTURE.md` for the design rationale.

## Endpoints

All `POST`, JSON body, CORS-restricted to `ALLOWED_ORIGIN`.

- `POST /submit/company` — `{ name, country?, flags: [{ category, description, severity, sourceUrl? }] }` (1-5 flags)
- `POST /submit/flag` — `{ companyId, flag: { category, description, severity, sourceUrl? } }`
- `POST /submit/barcode` — `{ gtin, companyId }`

Every flag category is validated live against the repo's own `data/categories.json` — no separate category list to keep in sync. Every submission lands as its own PR for maintainer review; flags always start as `status: "unverified"` regardless of whether a source URL was given, since an anonymous submitter's link isn't itself proof.

## Setup

```sh
npm install
npx wrangler secret put GITHUB_PAT
```

Use a **fine-grained personal access token** scoped to only this repository, with:
- Contents: Read and write
- Pull requests: Read and write

Nothing broader — this token lives in a public-facing Worker's secret store.

## Local dev

```sh
npm run dev
```

Runs against the real GitHub API for reads (categories, existing files) but any write call will fail without a real `GITHUB_PAT` bound locally (`wrangler dev` reads secrets from `.dev.vars`, which is gitignored — create one with `GITHUB_PAT=...` to test the full write path).

## Deploy

```sh
npm run deploy
```

Requires `wrangler login` once per machine.
