# Publishing `workplane` to npm

The installable package is [`packages/workplane`](../../packages/workplane) (name: **`workplane`** on npm).

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
pnpm pack --filter workplane
# inspect workplane-0.1.0.tgz
```

## First-time npm setup (maintainer)

1. Create an npm account and log in: `npm login`
2. Confirm name availability: `npm view workplane` (should 404 before first publish)
3. For CI, add repository secret **`NPM_TOKEN`** (Automation token with publish permission)

## Publish manually

From repo root after bumping `packages/workplane/package.json` version:

```bash
pnpm build
cd packages/workplane
npm publish --access public
```

## Publish via GitHub Release (recommended)

1. Bump version in `packages/workplane/package.json`
2. Merge to `main`
3. Create a GitHub release with tag `vX.Y.Z` matching the package version
4. Workflow [`.github/workflows/publish-npm.yml`](../../.github/workflows/publish-npm.yml) runs tests, builds, and publishes

## Install for users

```bash
npm install -g workplane
# or
npx workplane --help

workplane-server   # control plane
workplane-node     # worker
workplane-db-migrate
```

Users still need Postgres, `.env` configuration, and the deployment guide: [FLEET.md](./FLEET.md).
