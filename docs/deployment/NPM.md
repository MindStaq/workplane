# Publishing `workplane` to npm

The installable package is [`apps/workplane`](../../apps/workplane), published as **`workplane`** on npm. It bundles the
CLI, server, node and database code (`apps/cli`, `apps/server`, `apps/node`, `libs/db`) into one tarball with `tsup`. The
12 `@workplane/*` libraries under `libs/` are published separately.

Releases are driven by [Changesets](https://github.com/changesets/changesets). Builds are driven by [Nx](https://nx.dev).
Nothing in the repository publishes to npm unless the **Release** workflow (or the manual escape hatch) runs with a real
`NPM_TOKEN`.

## What gets published

| Binary | Role |
|--------|------|
| `workplane` | CLI (submit tasks, inspect runs, etc.) |
| `workplane-setup` | First-run wizard (configure and migrate) |
| `workplane-server` | Control plane API + DBOS |
| `workplane-node` | Polling node runtime |
| `workplane-db-migrate` | Apply the database schema |

Bundled output lives in `apps/workplane/dist/` (not committed). SQL migrations and schema files are copied into `dist/`.

The npm listing README is [`apps/workplane/README.md`](../../apps/workplane/README.md) (included via the `files` field; the
repo root README is not published).

Public packages are the ones whose `package.json` is not `private`. Internal apps and libraries (`apps/cli`, `apps/server`,
`apps/node`, `libs/db`, and later `apps/web` and `libs/ui`) are private and never published.

## Local build and dry run

```bash
pnpm install
pnpm build            # nx run-many -t build (cached)
pnpm pack:check       # exact file list of every tarball vs the committed snapshot
pnpm smoke:install    # pack the CLI, install it in a throwaway prefix and HOME, and drive it end to end
pnpm smoke:libs       # install every library tarball in a sandbox and import it
```

`pnpm pack:check` fails when a tarball gains or loses a file, or when a `main`, `types`, `bin` or `exports` target is
missing. After a deliberate change (for example a new migration) regenerate the snapshot with `pnpm pack:snapshot` and
review the diff.

## Releasing (recommended)

1. In your feature PR, add a changeset: `pnpm changeset`. Pick the packages and the bump type.
2. Merge to `main`. The **Release** workflow ([`release.yml`](../../.github/workflows/release.yml)) opens or updates a
   "chore: release packages" PR that applies the versions and changelogs.
3. Merge that PR. The workflow then builds with `--skip-nx-cache`, runs the same gates as CI (`pack:check`,
   `smoke:install`, `smoke:libs`) and runs `changeset publish`, which publishes only the versions not yet on the registry.

### Trying a release first (`next` tag)

Prereleases publish under the `next` dist-tag, so `npm install workplane` (which resolves `latest`) is not affected.

```bash
pnpm changeset pre enter next
pnpm changeset                  # describe the change
pnpm changeset version          # 0.4.4-next.0
git add -A && git commit
# merge; the Release workflow publishes with the "next" tag
```

Test it on a new machine:

```bash
npm install -g workplane@next
# or, with nothing installed but Node 20+:
node smoke-install.mjs --spec workplane@next      # script lives in scripts/smoke-install.mjs
```

To promote: `pnpm changeset pre exit`, add a changeset if needed, and release as usual. The final version is published
under `latest`.

## Rehearsal against a local registry

```bash
pnpm rehearse:publish
```

This starts a throwaway [Verdaccio](https://verdaccio.org) registry, copies the working tree, rewrites `publishConfig` to
the local registry, publishes all 13 packages, enters prerelease mode, publishes `next`, and then checks:

- `latest` and `next` dist-tags are correct for every package
- no published manifest contains a `workspace:` range
- the packed CLI passes `smoke:install` when installed from the registry (both versions)
- the libraries pass `smoke:libs`
- the prerelease `dist/` is identical to the previous release `dist/`

It uses an isolated npm user config and a fake token, and cannot reach npmjs.org.

## First-time npm setup (maintainer)

1. Log in: `npm login`
2. For CI, add repository secret **`NPM_TOKEN`** (Automation token with publish permission for `workplane` and the
   `@workplane` scope)

## Manual escape hatch

Run **Actions → Publish npm (manual) → Run workflow**. It runs tests, builds, the same gates, and `changeset publish`.
Use only when you must republish outside the Changesets flow.

## Install for users

```bash
npm install -g workplane
# or
npx workplane --help

workplane-setup
workplane-server
workplane-node
```

`workplane-setup` defaults to SQLite at `~/.workplane/workplane.db`, so Postgres is optional. Native modules
(`better-sqlite3`, `node-pty`) use prebuilt binaries where available; otherwise the machine needs a C/C++ toolchain and
Python. Deployment guide: [FLEET.md](./FLEET.md).
