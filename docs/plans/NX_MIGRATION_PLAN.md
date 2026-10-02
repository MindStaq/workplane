# Nx Migration and Web App Readiness Plan

**Status:** Phases 0 to 6 complete and locally verified (branch `cursor/nx-migration-plan-92d8`). Phase 7 is verified locally; the parts that need a real npm publish and a second machine are yours (see the handover under Phase 7). Phases 8 to 10 are complete on the stacked branch `cursor/web-readiness-92d8`, **stopping at the point where the prototype is needed from you**.
**Branches:** `cursor/nx-migration-plan-92d8` (phases 0 to 7), `cursor/web-readiness-92d8` (phases 8 to 10, stacked on the first)

## 1. Goal and end state

Get the repository to the point where a Next.js / React / TypeScript high-fidelity prototype can be dropped in and
turned into the first Workplane web app, on top of a workspace that is organised for several apps and libraries.

There is one hard predecessor, called **Gate G1** below:

> A new version of the `workplane` CLI, built and published to npm through the Nx-based pipeline, installs on a clean
> machine and behaves exactly as the previous version did.

Everything after G1 (API additions, web app scaffold, prototype intake) is only started once G1 is green. Everything
before G1 is a **pure restructure with no behaviour change**.

### Guiding rules

1. **No behaviour change before G1.** Restructuring PRs must not alter runtime behaviour, CLI output, HTTP routes, or the
   database schema. Any bug found along the way is logged in section 4 and fixed after G1, in its own PR.
2. **Prove it, do not assume it.** Every phase ends with the verification commands in section 3 passing. A phase is not
   done until they do.
3. **Keep the old path until the new one is proven.** Legacy scripts stayed until Phase 6 so any phase could be reverted
   by reverting its commit; they have now been removed.
4. **One phase per PR, small commits inside it.** Each PR is independently revertable.
5. **Published artifacts are the contract.** What matters is what lands in the npm tarballs, not how the repo is laid out.

## 2. Baseline facts (measured before any migration work)

| Fact | Value |
|---|---|
| Public npm packages | 13: `workplane` plus 12 `@workplane/*` libraries |
| Latest published version | `0.4.3` for all 13 |
| Snapshot vs registry | The committed pack snapshot **matches the real 0.4.3 registry tarballs** file for file, for all 13 packages |
| Unit tests | 68 total, 67 pass, 0 fail, 1 skipped (`pnpm test` and `pnpm test:nx` agree) |
| Private internal modules | `cli`, `server`, `node`, `db` are bundled into `workplane` by tsup, not published |
| Bundle mechanism | `packages/workplane/tsup.config.ts` aliases `@workplane/*` to `src/` and copies `db` migrations and SQL into `dist/` |
| Smoke test vs the real registry release | `pnpm smoke:install --spec workplane@0.4.3` passes all 16 checks, so the smoke test is a valid "works as before" yardstick |
| Clean install of the packed CLI | `npm install` of the tarball takes about 15 seconds and pulls about 109 packages |
| Native dependencies | `better-sqlite3` and `node-pty` (prebuilt binaries or a build toolchain are needed on a new machine) |
| Cross-package relative imports | About 36 (`../../core/src/...` and similar); the pre-Nx tooling could not see them |

## 3. Verification toolkit (what proves "works as before")

These already exist and are the acceptance tests for every phase.

| Command | What it proves |
|---|---|
| `pnpm pack:check` | The exact file list that `npm pack` would publish for each public package equals the committed snapshot. Fails on added files, removed files, or `main` / `types` / `bin` / `exports` targets missing from the tarball. |
| `pnpm pack:snapshot` | Regenerates the snapshot. Only run on purpose, after a legitimate change (for example a new migration). |
| `pnpm smoke:install` | Packs the CLI, installs it into a throwaway prefix with a throwaway `HOME`, runs `workplane-setup`, starts the server and a node, submits a shell task, checks auth rejection, logs, `skill list` and schedule create and list. 16 checks. |
| `pnpm smoke:install --spec workplane@<version>` | The same 16 checks against a published registry version. This is the "new machine" test. The script uses only Node built-ins, so it can be copied to any machine with Node 20+ and run on its own. |
| `pnpm test` / `pnpm test:nx` | Unit tests (legacy globs and per-project Nx targets). Must equal 68 / 67 / 0 / 1 until tests are deliberately added. |
| `pnpm build:libs && pnpm build` / `pnpm build:nx` | Legacy and Nx builds. Must produce identical `pack:check` results. |

### Cache correctness (verified in Phase 1)

| Experiment | Result |
|---|---|
| Rebuild with no changes | 13 of 13 cache hits |
| Delete all `dist/`, rebuild | 13 of 13 restored from cache, `pack:check` passes |
| Edit a file in `packages/server` | 1 of 13 rebuilt (only the `workplane` bundle) |
| Edit a file in `packages/types` | 5 of 13 rebuilt (`types` and its dependants) |

## 4. Known issues found during the baseline (not fixed before G1)

These are existing behaviours, found while building the verification tooling. They are out of scope for the restructure
and are tracked here so they are neither lost nor accidentally "fixed" inside a no-behaviour-change PR.

| # | Issue | Impact | Planned |
|---|---|---|---|
| K1 | **Fixed in Phase 3.** The root `tsc -p tsconfig.json` has 7 pre-existing errors: 5 in `packages/db/src/sqlite-store.ts` (`$client` missing on `SqliteDb`) and 2 in `packages/node/src/index.ts` (lines 245 and 271, node-pty typing). Identical on a clean checkout. | There is no green typecheck, so a `typecheck` target cannot gate CI yet. | Phase 3 (type-only fixes, no runtime change) |
| K2 | `workplane-node` registers with the server once at startup and exits if the server is unreachable. | Starting the node before the server fails. The smoke test starts the node after the server is healthy. | Phase 8 (backlog) |
| K3 | `workplane-setup` uses `readline/promises`, which drops input piped before each prompt is shown. | The wizard cannot be scripted with `printf ... \|`. The smoke test answers each prompt as it appears. | Phase 8 (backlog) |
| K4 | **Fixed in Phase 3** (root is now `workplane-monorepo`, private). The root package and the published CLI are both named `workplane`. | Tooling that looks up "the workplane package" must filter out the root. The scripts do. | Phase 3 (rename root to a private name) |
| K5 | **Fixed in Phase 6.** `docs/deployment/NPM.md` describes a manual version-bump and GitHub-release flow, mentions Postgres only, and omits SQLite. The real flow is Changesets (`release.yml`). | Misleading release documentation. | Phase 6 |
| K6 | `LocalWorkplanContext` authenticates task submission with the node token, not the operator token. | Works while both tokens are equal or unset; surprising otherwise. | Phase 8 (backlog) |
| K7 | Nx infers an unused `nx-release-publish` target from `@nx/js`. | Harmless; publishing stays on Changesets. | Ignored |
| K8 | `@workplane/adapter-claude-code` and `@workplane/adapter-codex` import `@workplane/adapter-sdk` but do not declare it in `dependencies` (found by `smoke:libs`; the same on the real 0.4.3 registry packages). | A consumer installing only one of those adapters gets a failed import unless `adapter-sdk` happens to be installed. Recorded in `scripts/smoke-libs.known-issues.json` so the check passes today and fails on any new finding. | After G1: add the dependency declaration in its own changeset |
| K9 | Read endpoints (`GET /tasks`, `/runs`, `/logs`, ...) are served without a token even when `WORKPLANE_OPERATOR_TOKEN` is set; only writes require it (verified on a local instance). | Fine on localhost; a UI exposed to a network needs the opt-in in 8.7. | Phase 8 (opt-in, default unchanged) |

## 5. Decisions

Defaults below are what this plan assumes. Items marked **OPEN** need an explicit call before the phase that depends on them.

| ID | Decision | Default / recommendation | Needed by |
|---|---|---|---|
| D1 | Release tool | Keep **Changesets** for versioning, changelogs and publishing. Use Nx only to build, test and cache. Do not adopt `nx release`. | Phase 6 |
| D2 | Directory layout | Move to `apps/` and `libs/`. **Decided: everything moves, including the bundle, which is now `apps/workplane`** (it is an app, and Nx's `apps/` and `libs/` convention is followed without exceptions). `pack:check` is keyed by package name so the move was provably a no-op for the tarballs. | Phase 5 |
| D3 | Nx Cloud / remote cache | No. Local cache plus the GitHub Actions cache is enough for now. | Phase 2 |
| D4 | Lint stack for boundaries | A minimal ESLint flat config containing only `@nx/enforce-module-boundaries`. The repo has no ESLint today. | Phase 3 |
| D5 | Web app distribution | Not part of the npm `workplane` package in this plan. Later options: a `workplane-ui` bin, or a static export served by `workplane-server`. **OPEN** | After Phase 10 |
| D6 | Styling and component system | **Decided at Phase 11:** Tailwind CSS v4 with shadcn/ui ("base-nova" style on `@base-ui/react`), because that is what the prototype is built on. Tokens and primitives live in `libs/ui`; `apps/web` imports `libs/ui/src/tokens.css` and tells Tailwind to scan `libs/ui` (`@source`). | Phase 9 |
| D8 | Data fetching in the web app | **Decided at Phase 11:** no client-side data library. Server components read the control plane with `@workplane/client` (token stays on the server) and an `AutoRefresh` client component calls `router.refresh()` every 5 s, paused in hidden tabs. Client code (mutations, incremental log polling) uses `@workplane/client` through the `/api/workplane` proxy. Revisit if server-sent events land. | Phase 11 |
| D7 | Version for the G1 release | A patch release published first as a prerelease (`0.4.4-next.0`), then promoted. Nothing functional changes. | Phase 7 |

## 6. Target workspace layout (after Phase 5 and Phase 9)

```
apps/
  cli/            private   source of the `workplane` command
  server/         private   control plane
  node/           private   worker
  web/            private   Next.js operator console             (Phase 9)
libs/
  types/  core/  client/    client is new in Phase 8
  db/
  adapter-sdk/  adapter-shell/  adapter-ollama/  adapter-aider/
  adapter-harness/  adapter-claude-code/  adapter-codex/
  workplans/  agent-skills/  dbos/
  ui/                       design system slot                    (Phase 9)
  (apps/workplane/  public  publish-only bundle: cli + server + node + migrate + setup)
docs/ scripts/ website/
```

### Dependency rules (enforced in Phase 3)

Tags per project (as implemented in each `project.json`): `type:lib | type:app | type:bundle`,
`runtime:universal | runtime:browser | runtime:node`, `scope:core | scope:adapter | scope:workplans | scope:data`,
`publish:npm | publish:private | publish:bundle`. The exact constraints are in `eslint.config.mjs`.

| From | May depend on | Must not depend on |
|---|---|---|
| `scope:web` | `types`, `client`, `ui` | `db`, `node`, `server`, any adapter, `dbos`, `workplans` (runtime), anything using `node-pty` or `better-sqlite3` |
| `type:lib` | other libs | any `type:app` |
| `types`, `core` | nothing internal (leaf libraries) | everything else |
| `adapter-*` | `adapter-sdk`, `core`, `adapter-harness` | `server`, `db`, `cli` |
| `type:app` | libs | other apps |
| `publish:npm` library | only other `publish:npm` projects | `publish:private` projects |

---

## Phase 0: Baseline guards. DONE

**Goal:** make "unchanged output" measurable before touching anything.

- [x] 0.1 `scripts/pack-manifest.ts` and `scripts/pack-manifest.snapshot.json`: snapshot of `npm pack` file lists for every public package, keyed by package name (valid after packages move); entry-point existence check; `--write` and `--only` modes.
- [x] 0.2 Prove the guard fails on a removed directory, an added stray file, and a missing `dist/`.
- [x] 0.3 `scripts/smoke-install.mjs`: dependency-free clean-install end-to-end test with `--spec`, `--tarball` and local-pack modes.
- [x] 0.4 Wire `pack:check`, `pack:snapshot`, `smoke:install` into `package.json` and the CI build job.
- [x] 0.5 Validate the snapshot against the real 0.4.3 registry tarballs (all 13 match).
- [x] 0.6 Record baseline test counts and the known issues in section 4.

**Exit criteria:** met. Commit `3f68dc2`.

## Phase 1: Nx in place. DONE

**Goal:** Nx understands the repo and caches correctly, with no file moves and no change to existing scripts.

- [x] 1.1 Add `nx` and `@nx/js` (23.2.1) as root devDependencies.
- [x] 1.2 `nx.json`: `namedInputs` (`default`, `sharedGlobals`, `production`), cached `build` target default with `dist` outputs, analytics off.
- [x] 1.3 Use `@nx/js` import analysis so the real `cli`, `server`, `node` and `db` edges appear in the graph (without it, every relative-import edge was invisible and caching would have been unsafe).
- [x] 1.4 Declare the `workplane` bundle's implicit dependencies (`cli`, `server`, `node`, `db`) and drop its `^build` dependency, since tsup bundles from source.
- [x] 1.5 Add per-project `test` scripts (`core`, `server`, `adapter-sdk`, `node`, `workplans`, `agent-skills`, `db`) mirroring the existing root globs.
- [x] 1.6 Add `build:nx`, `test:nx`, `graph:nx`; leave every existing script untouched. Ignore `.nx` cache directories.
- [x] 1.7 Verify: cache behaviour (section 3), identical `pack:check`, identical test counts, `pnpm install --frozen-lockfile`, legacy scripts, smoke test.

**Exit criteria:** met. Commit `ca0da01`.

## Phase 2: Nx drives CI and local development (no layout change). DONE

**Goal:** CI and day-to-day commands go through Nx, with legacy scripts still available as a fallback.

- [x] 2.1 `ci.yml`: add `fetch-depth: 0` and `nrwl/nx-set-shas`; on pull requests run `nx affected -t build test`; on `main` run the full `nx run-many -t build test`.
- [x] 2.2 Keep `pack:check` and `smoke:install` as unconditional CI steps (they are cheap relative to the risk they cover).
- [x] 2.3 Cache `.nx/cache` in GitHub Actions, keyed on lockfile and commit SHA with a restore fallback (D3: no Nx Cloud).
- [x] 2.4 Add `serve` targets for `server` and `node` (long-running, using the existing `dev:server` and `dev:node` commands) so `nx run-many -t serve -p @workplane/server @workplane/node` starts a local stack. Keep `pnpm dev:server` and `pnpm dev:node`.
- [x] 2.5 Repoint `build` and `test` to Nx and keep the previous commands as `build:legacy`, `build:libs:legacy` and `test:legacy` for one phase.
- [x] 2.6 Document the new commands in the README "Development" section (additive; existing instructions stay).
- [x] 2.7 Do **not** touch `release.yml` or `publish-npm.yml` in this phase.

**Verification:** CI green on a PR that changes only `packages/server` (confirm only `workplane` and `server` run) and on a PR that changes `packages/types` (confirm dependants run). `pack:check`, `smoke:install`, test counts unchanged.
**Rollback:** revert the PR; legacy scripts still exist.
**Risks:** `nx affected` can under-select if the graph misses an edge. Mitigation: the `workplane` bundle has explicit implicit dependencies, and `main` always runs the full set.

## Phase 3: Hygiene, identity and boundaries. DONE

**Goal:** the graph is trustworthy and the dependency rules in section 6 are enforced mechanically. Still no runtime behaviour change.

- [x] 3.1 Move the `paths` map from `tsconfig.json` into `tsconfig.base.json` and give every project a `tsconfig.json` that extends it. Reason: tests now run with each package as the working directory, and `tsx` resolves path aliases from the nearest `tsconfig.json`; a package-local tsconfig without `paths` would break alias imports.
- [x] 3.2 Type fixes for K1 (the 7 baseline errors). Type-level changes only (for example a correct `BetterSQLite3Database & { $client }` type and a node-pty typing); no runtime change. Prove it with an unchanged test run and an unchanged bundle: diff `dist/*.js` before and after.
- [x] 3.3 Add a `typecheck` target (`tsc --noEmit` per project) and make it a CI step once green.
- [x] 3.4 Rename the root package to `workplane-monorepo` (private) to resolve K4. Confirm `pack:check` and `smoke:install` still find the right package.
- [x] 3.5 Add `nx.tags` to every `package.json` per the tag scheme in section 6.
- [x] 3.6 Boundary enforcement (D4): minimal ESLint flat config with only `@nx/enforce-module-boundaries`, encoding the table in section 6. Add `lint` as a CI step.
- [x] 3.7 Replace the ~36 cross-package relative imports with `@workplane/*` imports, one package at a time, in this order: `types`, `core`, `db`, `workplans`, `adapter-*`, then `cli`, `server`, `node`. Use `import type` wherever the import is type-only so published libraries do not gain runtime dependencies.
- [x] 3.8 Fail the build on a project-graph cycle. (`@nx/enforce-module-boundaries` reports circular dependencies by default, and `lint` runs in CI.)

**Verification after every package in 3.7:** `pnpm build:nx`, `pnpm test:nx`, `pnpm pack:check`, `pnpm smoke:install`, plus `git diff` of the built `dist/*.js` for the `workplane` bundle showing no behavioural change (bundled output should be equivalent apart from module ordering).
**Rollback:** revert the PR. Do 3.7 as several commits so a bad package can be reverted alone.
**Risks:**
- Published libraries' `.d.ts` could start referencing `@workplane/*` packages that are not declared dependencies. Mitigation: Phase 4.
- tsup treating a newly package-named import as external when it was previously inlined. Mitigation: 3.7 order, `import type`, and the Phase 4 audit.

## Phase 4: Library publish safety net. DONE

**Goal:** the 12 `@workplane/*` libraries, not only the CLI, are proven installable and importable before release. The existing smoke test only exercises `workplane`.

- [x] 4.1 `scripts/smoke-libs.mjs`: pack every public library, install all the tarballs together into a throwaway project, `import()` each entry point, and print the exported names.
- [x] 4.2 In the same script, compile a tiny TypeScript file that imports types from each library with `tsc --noEmit`, so a broken or dangling `.d.ts` reference is caught.
- [x] 4.3 Declared-dependency audit: for each library, scan `dist/*.js` and `dist/*.d.ts` for bare specifiers and fail if one is not listed in `dependencies` or `peerDependencies`.
- [x] 4.4 Fix any finding with the smallest change (usually adding a missing dependency declaration). If a fix changes a published `package.json`, include it in the G1 release notes.
- [x] 4.5 Add `smoke:libs` to `package.json` and the CI build job.
- [x] 4.6 Run `smoke:libs` against the registry versions (`--spec ...@0.4.3`) once, to learn whether 0.4.3 already has any of these problems. Findings become K-items, not blockers.

**Exit criteria:** `pnpm smoke:libs` passes locally and in CI.

## Phase 5: Directory layout (decision D2). DONE

**Goal:** `apps/` and `libs/` exist and the old `packages/` directories are gone, except `packages/workplane`. Do this only after Phase 3 has made imports path-independent.

- [x] 5.1 Decide D2. If the answer is "stay in `packages/`", skip to Phase 6; nothing later depends on this phase.
- [x] 5.2 Update `pnpm-workspace.yaml` to `apps/*`, `libs/*`, `packages/*`.
- [x] 5.3 `git mv` each project (history is preserved) in one mechanical commit with no content edits.
- [x] 5.4 Fix paths in a second commit: `tsconfig.base.json` `paths`, tsup alias and entry paths in `packages/workplane/tsup.config.ts` (derive the alias table from the tsconfig paths so it is no longer hand-maintained), migration and SQL copy paths in its `onSuccess`, `drizzle.config*.ts`, root `package.json` scripts (`dev:*`, `db:*`), workflows, `scripts/*`, `.env.example` if it references paths.
- [x] 5.5 Update `repository.directory` in published `package.json` files where it exists.
- [x] 5.6 Update documentation paths (`README.md`, `docs/**`).
- [x] 5.7 Verify `pnpm-lock.yaml` changes are limited to workspace path entries.

**Verification:** the full toolkit in section 3. `pack:check` must pass **without regenerating the snapshot**, because it is keyed by package name; a passing check is the proof that the move changed nothing that ships. Pay particular attention to `dist/migrations/**` in the `workplane` tarball.
**Risks:** a wrong relative path in `onSuccess` can still build and yet ship without migrations; `pack:check` and `smoke:install` (which runs migrations through `workplane-setup`) both cover this.

## Phase 6: Release pipeline on Nx. DONE

**Goal:** the same Changesets flow publishes the same artifacts, but built through Nx and gated by the verification toolkit.

- [x] 6.1 `release.yml`: after `pnpm install --frozen-lockfile`, build with `nx run-many -t build --skip-nx-cache` (release builds never trust the cache), then run `pack:check`, `smoke:install` and `smoke:libs`, then the Changesets action.
- [x] 6.2 `publish-npm.yml` (manual fallback): same gate steps; keep it as the escape hatch.
- [x] 6.3 Confirm `workspace:` ranges, if any exist, are rewritten at publish time. Publish must go through `pnpm changeset publish`, not raw `npm publish`.
- [x] 6.4 Publish rehearsal against a local registry: `scripts/rehearse-publish.mjs` (or a CI job) starts Verdaccio, runs `changeset publish` against it, installs `workplane` from that registry on a clean prefix, and runs `smoke:install --spec` against it. This exercises the real publish path without touching npmjs.
- [x] 6.5 Prerelease flow: document and test `changeset pre enter next`, publishing under the `next` dist-tag, and `changeset pre exit`.
- [ ] 6.6 Optional (not done): publish with provenance (`--provenance`); `publish-npm.yml` already requests `id-token: write`.
- [x] 6.7 Delete the legacy scripts (`build:libs`, `*:legacy`) and the hand-maintained `--filter` list. Keep `dev:*`, `uat:*`, `db:*`.
- [x] 6.8 Rewrite `docs/deployment/NPM.md` to match the real flow (K5): Changesets, SQLite default, the gates, the prerelease flow, the rehearsal.

**Verification:** a rehearsal run is green end to end. A dry-run of `changeset publish` against the real registry in "what would be published" mode lists exactly the expected packages.
**Risks:** this phase touches the publishing path. Do it behind the rehearsal (6.4) and do not cut a real release from this PR.

## Phases 2 to 6: what was actually done and how it differs from the plan

Results, all measured on this branch:

| Check | Result |
|---|---|
| `nx run-many -t build lint typecheck test --skip-nx-cache` | 17 projects, all green (first fully green typecheck; K1 fixed) |
| Unit tests | 68 total, 67 pass, 0 fail, 1 skipped (unchanged from the baseline) |
| `pack:check` | Passes against the **unchanged** snapshot, before and after the `apps/` and `libs/` move |
| Built libraries vs the original build | 12 libraries byte-identical (`.js`, `.d.ts`) |
| Built `workplane` bundle vs the real 0.4.3 registry tarball (`scripts/dist-compare.mjs`) | 12 identical files, 5 reordered (same code, different module order), 0 different |
| `smoke:install` | 16 of 16, against the local pack and against the real `workplane@0.4.3` |
| `smoke:libs` | 25 of 25, against local packs and the real 0.4.3 libraries |
| `rehearse:publish` | 36 checks pass (13 packages published to a throwaway Verdaccio registry, `latest=0.4.3`, `next=0.4.4-next.0`, no `workspace:` ranges, clean installs pass both smoke tests, prerelease `dist` equals previous `dist`) |
| Local instance from source (`nx serve` for server and node, then the CLI) | Shell task succeeds with logs, failing task reports `failed`, `skill run hello`, schedule create and tick, writes without a token return 401 |

Deviations from the original task list, and why:

- **Nx configuration lives in `project.json`, not in `package.json`.** Nx fields and scripts in a `package.json` would ship
  inside the published tarballs. With `project.json` every published `package.json` is identical to `main`.
- **Added `@nx/js`, `@nx/eslint`, `@nx/eslint-plugin`, `typescript-eslint`, `eslint`** (boundaries) and `verdaccio` (rehearsal).
- **`tsconfig.base.json` needs `baseUrl: "."`** or `tsup`'s declaration build cannot resolve the `@workplane/*` paths.
- **`@workplane/db` has two entry points** in the alias table: `@workplane/db` (store creation) and `@workplane/db/migration`
  (migrations). Exporting migrations from the main entry made the `setup` bundle balloon.
- **Published `.d.ts` files had to stay identical.** `adapter-claude-code` and `adapter-codex` now list `adapter-sdk` as an
  external in `tsup`; two type-only relative imports in `libs/workplans` and `libs/dbos` are kept on purpose and carry a
  documented lint exception.
- **`pnpm pack` must be used (not `npm pack`)** in the scripts, because only `pnpm pack` rewrites `workspace:*` to exact
  versions. This is exactly what `changeset publish` does through pnpm.
- **Extra tooling that was not in the plan:** `scripts/dist-compare.mjs` (semantic comparison of built bundles),
  `scripts/smoke-libs.known-issues.json`, `pnpm rehearse:publish`.

## Phase 7: Release candidate and new-machine acceptance. **Gate G1**

**Goal:** publish through the new pipeline and prove a clean machine behaves as it did with 0.4.3.

- [ ] 7.1 Add a changeset (patch) for all affected packages, entered in prerelease mode so the version is `0.4.4-next.0` (D7). The release notes state plainly: build and repository restructure, no functional change.
- [ ] 7.2 Merge to `main`; the Release workflow opens the version PR; merge it; the workflow publishes under the `next` dist-tag. Confirm `latest` is still `0.4.3`.
- [x] 7.3 (done locally against the real 0.4.3 tarball; the same comparison for the published `next` is yours) Registry comparison: `npm pack` the new `next` versions and compare file lists with the 0.4.3 registry tarballs (the baseline in section 2). Differences must be explainable and approved. A `--against-registry <version>` option on `pack-manifest.ts` makes this one command.
- [x] 7.4 (local pack and real 0.4.3 both pass the same 16 checks; repeat with `--spec workplane@next` after publishing) Behaviour comparison: run `node scripts/smoke-install.mjs --spec workplane@0.4.3` and `--spec workplane@next` and diff the two outputs. Both must pass the same 16 checks.
- [ ] 7.5 Clean-machine matrix, using the standalone smoke script copied to each machine:

  | Machine | Node | Purpose |
  |---|---|---|
  | Fresh Linux container (`node:20-slim`) | 20 | Minimum supported version; checks that prebuilt native binaries install without a toolchain |
  | Fresh Linux container | 22 | Current LTS |
  | macOS (Apple silicon) | current | Developer laptop; native module prebuilds |
  | Your second machine | any | The human check: `npm i -g workplane@next`, `workplane-setup`, then follow the Quick start in the README |
  | Windows | 20 | Record the result only; support status is unchanged (K-item if broken in both versions) |

- [ ] 7.6 `scripts/smoke-docker.sh` runs the smoke test in the Linux containers so the matrix rows above are one command.
- [ ] 7.7 Human acceptance checklist (run on the second machine): `workplane --help`; `workplane-setup` with all defaults; `workplane-server` and `workplane-node` in two terminals; `workplane task submit shell --command "echo hello"`; `workplane tasks`; `workplane logs <runId>`; `workplane skill list`; `workplane skill run hello`; `workplane schedule create hello ...` and `workplane schedule list`.
- [ ] 7.8 Promote: add the `latest` dist-tag to the new version (or exit prerelease mode and publish the stable `0.4.4`), create the GitHub release, update the README "Progress" table.

### Handover: what is left for you (these need npm credentials or other machines)

The agent environment has no npm token (by design, so nothing can reach npmjs.org), no Docker, and a single Linux machine.
Everything that can be proven without those has been proven (see the results table above). To finish G1:

1. Review the `.changeset` flow. This branch deliberately contains **no** release changeset and **no** `.changeset/pre.json`.
2. Run `pnpm changeset pre enter next`, `pnpm changeset` (patch for all 13 packages; text: "Build and repository restructure, no functional change"), `pnpm changeset version`, commit and merge. Make sure the repository secret `NPM_TOKEN` is set. The Release workflow publishes `0.4.4-next.0` under the `next` tag; `latest` stays `0.4.3`.
3. On a second machine: `node smoke-install.mjs --spec workplane@next` (copy `scripts/smoke-install.mjs`), then the manual checklist in 7.7.
4. If it is good: `pnpm changeset pre exit`, release, and update the README progress table (7.8).

Not done here and still open: 7.5 container and macOS matrix, 7.6 `smoke-docker.sh` (needs Docker), 7.2 and 7.8 (need publishing rights).

**Gate G1 exit criteria (all must hold):**
1. The published `next` tarballs have the same file lists as 0.4.3 (or approved, documented differences).
2. `smoke:install --spec workplane@next` passes all checks on both Linux containers and on at least one real second machine.
3. `smoke:libs --spec` passes for the libraries.
4. Your manual checklist (7.7) passes on the second machine.
5. `latest` still points at a version that passed 1 to 4.

**Rollback:** `npm dist-tag` can re-point `latest`/`next`; `npm deprecate` marks a bad version. No unpublish is needed because the first publish is a prerelease.

---

*Everything below is allowed to change behaviour, but each change is its own PR with its own changeset. Start only after G1.*

## Phase 8: API readiness for a UI. TIER 1 DONE

**Goal:** close the gaps that stop a browser UI from using the control plane well. Tier 1 items are required before the prototype is converted; tier 2 items can follow it.

**Tier 1 (required)**

- [x] 8.1 New library `@workplane/client` (public): typed methods for every operator-facing endpoint, shared error type, token handling. Extract and replace the CLI's `httpJson` and `core/http-client.ts`. Add response envelope types (`{ tasks }`, `{ runs }`, `{ logs }`, and so on) to `@workplane/types`. Unit-test against an in-process server.
- [x] 8.2 Migrate the CLI to `@workplane/client` with no change to command output. Check with a recorded-output comparison per CLI command.
- [x] 8.3 `GET /nodes` plus `listNodes` on the store interface (SQLite and Postgres implementations).
- [x] 8.4 Incremental logs: `GET /runs/:id/logs?afterId=` returning only newer rows.
- [x] 8.5 Skill metadata: `GET /skills` with name, description and a JSON-Schema description of each skill's inputs. Add an input schema to `SkillEntry`.
- [x] 8.6 CORS: opt-in via `WORKPLANE_CORS_ORIGINS`. Default stays closed. (The Next.js app proxies server-side, so CORS is only for non-proxy deployments.)
- [x] 8.7 Optional read protection: `WORKPLANE_PROTECT_READS=true` requires the operator token on `GET` routes. Default is unchanged for compatibility.
- [x] 8.8 Contract tests: the client run against the real server over HTTP for every endpoint the UI will call.

**Tier 2 (can follow the prototype)**

- [ ] 8.9 Server-sent events for run logs and status (`/runs/:id/events`).
- [ ] 8.10 `POST /workplan-runs` (run a skill ad hoc through the server) and a link from workplan step results to their underlying task and run.
- [ ] 8.11 Node registration retry (K2); scriptable `workplane-setup` flags (K3); node-token vs operator-token handling in `LocalWorkplanContext` (K6).

**What was built (Phase 8, branch `cursor/web-readiness-92d8`):**

- `libs/client` (`@workplane/client`, public, zero runtime dependencies, uses only `fetch`): typed methods for every operator endpoint, `WorkplaneApiError`, injectable `fetch`. Response envelope types, `SkillSummary` and `SkillInputSchema` were added to `@workplane/types`.
- The CLI now goes through the client. A recorded before/after comparison of 25 CLI invocations against the same server showed identical output (only the timestamp inside a workspace path differs). The one visible change is that the client sends the operator token on reads as well as writes, which is what a protected server needs; error text is unchanged (`Error: 404 Not Found from /tasks/x: ...`).
- `GET /nodes` (`listNodes` in the SQLite and Postgres stores), `GET /skills` (`SkillEntry.inputSchema`), `GET /runs/:id/logs?afterId=` (log rows are now ordered by timestamp then id so the cursor is stable), opt-in CORS (`WORKPLANE_CORS_ORIGINS`), opt-in authenticated reads (`WORKPLANE_PROTECT_READS=true`; accepts the operator or node token because nodes read `/runs/:id` and `/tasks/:id` too).
- Contract tests (`apps/server/src/contract.test.ts`) start the real server over a temporary SQLite database and drive it through the client: lifecycle, nodes, logs with cursor, artifacts, input events, schedules, workplan runs, typed errors, CORS, protected reads. Unit tests for the client, CORS and read protection were added. Node tests went from 68 to 85 (84 pass, 0 fail, 1 skipped).
- The only `pack:check` snapshot change is the new package `@workplane/client`; the other 13 entries are unchanged.

**Tier 2 (8.9 to 8.11) is intentionally not done**; the gaps are listed in `docs/design/PROTOTYPE_INTAKE_TEMPLATE.md`.

**Release note:** `@workplane/client` is a new public package and several libraries gain additive fields. This branch deliberately contains **no changeset**; add one (minor) when you decide to release it, after G1.

**Verification:** all existing tests plus the new contract tests; `smoke:install` still passes with the migrated CLI; a recorded before/after of CLI output is identical.

## Phase 9: Web app scaffold. DONE

**Goal:** an empty but fully wired Next.js app exists in the workspace, so the prototype can be dropped into a known-good home.

- [x] 9.1 Generate `apps/web` with `@nx/next` (App Router, TypeScript). Mark it `"private": true` with tags `type:app`, `scope:web`, `publish:private`. Confirm `pack:check` is unaffected (it must not see a new public package).
- [x] 9.2 `libs/ui`: empty design-system library with a story-less starter (tokens file, one primitive). Styling system left open (D6); the prototype decides it.
- [x] 9.3 Server-side proxy: route handlers at `apps/web/app/api/workplane/[...path]` forward to the control plane and attach the operator token from a server-only environment variable. The browser never sees the token. The web app imports only `@workplane/client`, `@workplane/types` and `ui`.
- [x] 9.4 Boundary check: prove that importing `@workplane/db` or `node-pty` from `apps/web` fails lint.
- [x] 9.5 Dev stack: `pnpm dev:all` (or `nx run-many -t serve`) starts the server, a node and the web app together; `apps/web/.env.example` documents the variables; the web app has a visible "cannot reach control plane" state.
- [x] 9.6 `scripts/seed-dev-data.ts`: creates sample tasks (succeeded, failed, running, queued), a schedule and workplan runs in a throwaway SQLite database, so the UI never starts empty and every state is reachable.
- [x] 9.7 Test infrastructure: Vitest and Testing Library for `libs/ui` and `apps/web`; a Playwright smoke test that loads the dashboard against the seeded stack.
- [x] 9.8 CI: `lint`, `typecheck`, `build` and `test` for the web app via `nx affected`; the Playwright job runs on `main` and on PRs touching `apps/web` or `libs/**`.
- [x] 9.9 A placeholder page that lists tasks through the proxy and client. It exists only to prove the whole path (browser, Next proxy, client, server, database) and will be replaced by the prototype.

**What was built (Phase 9):**

- `apps/web`: Next.js 16 (App Router, React 19), private, tags `type:app`, `runtime:browser`, `scope:web`, `publish:private`. Written by hand rather than with the `@nx/next` generator (a smaller footprint; Nx targets are in `project.json`). It builds with **webpack** (`next build --webpack`), because Turbopack cannot map the libraries' NodeNext-style `./x.js` imports to `.ts` sources; `next.config.ts` carries the `extensionAlias` and a comment.
- `libs/ui`: neutral placeholder tokens (`tokens.css`, import path `@workplane/ui/tokens.css`) and one primitive (`StatusBadge`). Styling system is still open (D6).
- Proxy route `apps/web/app/api/workplane/[...path]`: forwards an **allow-list** of operator routes (`src/lib/proxy-policy.ts`, unit-tested); node-only routes return 403. The operator token is read from server-only `WORKPLANE_OPERATOR_TOKEN`.
- Placeholder dashboard: polling task list with loading, empty and "Cannot reach the control plane" states.
- Boundaries: `runtime:browser` projects may only depend on universal or browser projects and may not import `node-pty`, `better-sqlite3`, `pg`, `drizzle-orm`, `dotenv`. `pnpm check:web-boundaries` proves 7 forbidden imports fail and 2 allowed imports pass (lints snippets in memory).
- `pnpm dev:all` (`scripts/dev-all.mjs`): migrates and seeds an isolated database (`.workplane/dev/dev.db`), starts the server, waits for `/healthz` (K2 workaround), then the node and the web app, with prefixed logs and clean shutdown. `scripts/seed-dev-data.ts` creates tasks in every status, runs with logs and artifacts, two nodes, two schedules and three workplan runs.
- Tests: Vitest + Testing Library for `libs/ui` and `apps/web` (10 tests); Playwright smoke (3 tests: seeded dashboard, token never reaches the browser, proxy refuses node routes) using the Chrome already installed on machines and GitHub runners. CI: `check:web-boundaries` added to `ci.yml`; new `web-e2e.yml` runs on `main` and on PRs touching the web app, server, libs or the dev scripts.
- Manually verified with `pnpm dev:all`: a task created through the web proxy was executed by the real node (`succeeded`), seeded states render, node routes via the proxy return 403.

**Verification:** `pnpm dev:all` shows seeded tasks in the placeholder page; web CI is green; `pack:check` and `smoke:install` unchanged; the boundary test (9.4) fails as intended.

## Phase 10: Prototype intake and definition of ready. DONE

**Goal:** a clear, low-friction place and process for you to hand over the high-fidelity prototype.

- [x] 10.1 Create `docs/design/` with a `README` that states the expected prototype format: Next.js / React / TypeScript, source (not a screenshot export), with routes, components, design tokens, and mocked data isolated behind one data module so it can be replaced by real client calls.
- [x] 10.2 Provide `docs/design/PROTOTYPE_INTAKE_TEMPLATE.md`: a screen-by-screen table (screen, states needed: empty, loading, error, live, API calls required, existing endpoint, gap).
- [x] 10.3 Reserve `design/prototype/` (excluded from lint, build and the Nx graph) as the landing place for the raw prototype so it can be reviewed without affecting CI.
- [x] 10.4 Document the conversion approach: copy screens into `apps/web`, move tokens and primitives into `libs/ui`, replace the mock data module with `@workplane/client` hooks (data-fetching library choice recorded as a decision then), polling intervals for live views until Phase 8.9 lands.
- [x] 10.5 Run the intake template against the Phase 8 API and list any remaining gaps as issues, so the first conversion PR starts with a known scope.

**What was built (Phase 10):** `docs/design/README.md` (what to hand over, where it goes, how it is converted, the enforced rules, how to run the stack), `docs/design/PROTOTYPE_INTAKE_TEMPLATE.md` (screen table, API mapping with every gap, decisions to record), `design/prototype/` (empty landing area; excluded through `.nxignore`, ESLint ignores, the pnpm workspace and the root tsconfig).

## Phase 11: Prototype conversion. DONE (first pass)

**Goal:** turn the uploaded v0 prototype (`workplane-ui-design.zip`) into the first real web app: real data, real actions, CI green.

- [x] 11.1 Keep the raw export in `design/prototype/` (excluded from CI) and write `design/prototype/INTAKE.md`: screens, API mapping, every gap found.
- [x] 11.2 `libs/ui`: tokens (dark oklch palette, one accent), the shadcn primitives the screens use, `StatusBadge`/`StatusDot`, and layout primitives (`PageHeader`, `Section`, `Panel`, `KeyValue`, `Capability`, `Mono`).
- [x] 11.3 `apps/web`: all 11 prototype screens plus loading, error and not-found states, on `@workplane/client`. Mock data module deleted.
- [x] 11.4 Live updates by polling (D8); incremental run logs; stdin, signals and resize on interactive runs.
- [x] 11.5 Real actions through the proxy: submit task, cancel, retry, pause/resume schedule, run schedule now.
- [x] 11.6 Actions the API cannot support yet are visible but disabled with an explanation (skill run, re-run plan, new schedule, search).
- [x] 11.7 Tests and CI: Vitest for the pure logic and the interactive components, Playwright against the seeded stack, `check:web-boundaries` still passes.

**What was built (Phase 11):**

- `libs/ui`: `src/tokens.css` (palette plus the Tailwind `@theme` mapping), `src/shadcn.css` (vendored shadcn custom variants), `src/components/*` (shadcn primitives, relative imports), `src/workplane/primitives.tsx`, `src/StatusBadge.tsx`. Dependencies: `@base-ui/react`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`. The library is still consumed as source (`transpilePackages`).
- `apps/web`: Tailwind v4 through `postcss.config.mjs` and `app/globals.css`; Geist fonts from the `geist` package (no network at build time); `src/lib/data.ts` (one loader per screen), `control-plane.ts` (server-only client, `server-only` import guard), `browser-client.ts`, `derive.ts`, `format.ts`, `submit.ts`, `logs.ts` (pure, unit-tested).
- Server change: `GET /runs/:id/input` now accepts the operator token as well as the node token, so the console can show input-event counts. Proxy allow-list and contract test updated.
- Seed data now includes a running interactive `claude-code` session, so the console is reachable in `pnpm dev:all` and in the e2e run.
- Tests: Vitest 33 in `apps/web` and 7 in `libs/ui`; Playwright 17 (every screen against seeded data, filters, submit then cancel, schedule toggle and run-now, interactive stdin, a no-console-errors sweep that catches hydration mismatches, token never reaches the browser, proxy refuses node routes).

**Deviations and findings:**

- The API refused things the prototype assumed it would accept (retry for cancelled tasks, operator reads of input events). One was fixed (input events); the other is recorded as a gap in `design/prototype/INTAKE.md`, together with 14 more.
- `typescript.ignoreBuildErrors` and the Vercel Analytics import from the export were dropped; fonts moved from `next/font/google` to the `geist` package.

**Verification:** lint, typecheck, test and build pass for every project; Playwright 17/17; `check:web-boundaries` 9/9; `pack:check` and `smoke:libs` unchanged.

### Definition of ready (the end state of this plan)

All of the following are true:

1. **G1 passed:** the Nx-built `workplane` CLI is published, and installs and runs on a clean second machine exactly as 0.4.3 did.
2. `pnpm build`, `test`, `lint`, `typecheck`, `pack:check`, `smoke:install` and `smoke:libs` pass locally and in CI, all through Nx.
3. Boundary rules are enforced; the web app provably cannot reach server-only code.
4. `@workplane/client` exists and the CLI uses it.
5. The Tier 1 API items (8.1 to 8.8) are in place and covered by contract tests.
6. `pnpm dev:all` brings up server, node and web with seeded data; the placeholder page works through the proxy.
7. `docs/design/` explains how to hand over the prototype and how it will be converted.

**Status:** items 2 to 7 are true and verified locally. Item 1 (G1) needs you: publish the `next` prerelease and test it on a second machine. The prototype has been received and converted (Phase 11).

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A moved path ships a tarball without migrations or `dist` files | Medium | High (broken first run) | `pack:check` (name-keyed) and `smoke:install` on every PR; rehearsal in Phase 6 |
| Graph misses an edge, so `affected` or the cache skips a needed rebuild | Medium | Medium | `@nx/js` import analysis; explicit implicit dependencies for the bundle; full builds on `main` and on release; `--skip-nx-cache` for releases |
| Replacing relative imports adds undeclared runtime dependencies to published libraries | Medium | High (library breaks for consumers) | `import type`; Phase 4 audit and consumer smoke test; Phase 3 order of work |
| Native modules fail to install on a new machine | Low to medium | High | Clean-machine matrix in Phase 7; recorded as a known requirement, unchanged by this work |
| Release pipeline change publishes something wrong | Low | High | Local-registry rehearsal; first publish is a prerelease under `next`; `latest` untouched until G1 |
| Scope creep: functional fixes slip into restructure PRs | Medium | Medium | Rule 1; known issues are logged in section 4 and fixed after G1 |
| Next.js bundler trouble with this repo's `NodeNext` / `.js` import suffixes | Medium | Low to medium | The web app imports only built or path-mapped libraries; extensionless-compatible exports for `client` and `types` verified in Phase 9 |

## Command quick reference

```bash
pnpm build                     # build everything through Nx (cached)
pnpm test                      # run all unit tests through Nx
pnpm lint                      # module-boundary rules
pnpm typecheck                 # tsc --noEmit per project
pnpm graph                     # open the project graph
pnpm smoke:libs                # install every library tarball in a sandbox and import it
pnpm rehearse:publish          # full publish rehearsal against a throwaway local registry
pnpm dev:all                   # server + node + web with seeded sample data (isolated database)
pnpm test:e2e                  # Playwright smoke test against a seeded stack
pnpm check:web-boundaries      # proves the web app cannot import server-only code
pnpm pack:check                # compare packed file lists with the snapshot
pnpm pack:snapshot             # regenerate the snapshot (deliberate changes only)
pnpm smoke:install             # clean-install end-to-end test of the packed CLI
pnpm smoke:install --spec workplane@0.4.3   # same test against a registry version
```
