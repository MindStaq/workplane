# Publishing `@mindstaq/workplane` to npm

The installable package is [`packages/workplane`](../../packages/workplane), published as **`@mindstaq/workplane`** on npm under the [mindstaq](https://www.npmjs.com/org/mindstaq) organization.

## What gets published

| Binary | Role |
|--------|------|
| `workplane` | CLI (submit tasks, inspect runs, etc.) |
| `workplane-server` | Control plane API + DBOS |
| `workplane-node` | Polling node runtime |
| `workplane-db-migrate` | Apply Postgres schema |

Bundled output lives in `packages/workplane/dist/` (not committed). `schema.sql` is copied into `dist/` for migrations.

## Local build and dry run

```bash
pnpm install
pnpm build
cd packages/workplane
npm pack --dry-run
```

## First-time npm setup (maintainer)

1. Log in to npm with access to the **mindstaq** org: `npm login`
2. Confirm you can publish: `npm org ls mindstaq` (your user should appear)
3. Confirm the name is free: `npm view @mindstaq/workplane` (404 before first publish)
4. For CI, add repository secret **`NPM_TOKEN`** (Automation token with publish access to the mindstaq org)

## Publish manually

From repo root after bumping `packages/workplane/package.json` version:

```bash
pnpm build
cd packages/workplane
npm publish --access public
```

Scoped packages require `--access public` unless the org default is public.

## Publish via GitHub Release (recommended)

1. Bump version in `packages/workplane/package.json`
2. Merge to `main`
3. Create a GitHub release with tag `vX.Y.Z` matching the package version
4. Workflow [`.github/workflows/publish-npm.yml`](../../.github/workflows/publish-npm.yml) runs tests, builds, and publishes

Or run **Actions → Publish npm → Run workflow** after setting `NPM_TOKEN`.

## Install for users

```bash
npm install -g @mindstaq/workplane
# or
npx @mindstaq/workplane --help

workplane-server
workplane-node
workplane-db-migrate
```

Users still need Postgres, `.env` configuration, and the deployment guide: [FLEET.md](./FLEET.md).
