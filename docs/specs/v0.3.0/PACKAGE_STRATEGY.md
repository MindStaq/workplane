# Package Strategy: Multi-Repo vs Monorepo

**Version:** 0.3.0  
**Status:** Decision required  
**Parent spec:** [WORKPLANE_SPEC.md](./WORKPLANE_SPEC.md)

---

## 1. What we're deciding

The v0.3.0 redesign introduces new packages:

| Package | Nature |
|---------|--------|
| `workplane` (core) | Infrastructure: server, node, CLI, adapter-sdk, core types |
| `workplane-dbos` | Optional durability layer (DBOS integration) |
| `workplane-workplans` | Workplan DSL, runner, output sinks |
| `workplane-agent-skills` | Pre-built skills as workplans |

The question is whether to develop and publish these as separate git repositories or keep them in the existing monorepo.

---

## 2. Option A: Keep everything in one monorepo

All packages live in `/packages/*` under the existing `workplane` repository, published individually via `pnpm publish` with a shared `pnpm-workspace.yaml`.

**Pros:**
- Atomic commits across packages (e.g., a change to `adapter-sdk` types and `workplane-workplans` in one PR)
- Shared TypeScript config, lint rules, and test setup
- `workspace:*` protocol allows local cross-package dependencies without publishing
- Single CI pipeline; one place to run all tests
- Easier to keep inter-package interfaces in sync during active development

**Cons:**
- Root `package.json` grows heavy; newcomers see all packages at once
- Versioning discipline required — a patch to `workplane-dbos` should not force a `workplane-workplans` version bump
- Publishing requires tooling (Changesets or equivalent) to manage which packages changed
- Risk of accidental coupling: shared `devDependencies` at root can leak into published packages

**Publishing tooling needed:** `changesets` or `lerna version` (Changesets is the modern standard for pnpm monorepos).

---

## 3. Option B: Multiple focused repositories

Each logical product lives in its own repository:

| Repo | Packages inside |
|------|----------------|
| `workplane` | `core`, `types`, `db`, `server`, `node`, `cli`, `adapter-sdk`, all adapter packages |
| `workplane-dbos` | single package |
| `workplane-workplans` | single package |
| `workplane-agent-skills` | single package |

**Pros:**
- Clean separation: contributors to `workplane-agent-skills` don't need to understand the server internals
- Each repo has its own issues, CI, changelogs, and release cadence
- Smaller surface area per repo — faster `git clone`, fewer files to navigate
- Forces clean API boundaries (you can't use `workspace:*`; you must publish and depend)

**Cons:**
- Cross-cutting changes require coordinated PRs and version bumps across repos
- During active development, you often need to use `npm link` or `file:` overrides, which is friction
- Multiple CI pipelines to maintain
- Type changes in `workplane` core (e.g., adding a field to `WorkplanStep`) require publishing `workplane`, then updating `workplane-workplans` in a separate commit

---

## 4. Analysis

The monorepo vs multi-repo debate is mostly about **phase of development** and **team size**.

**Right now:**
- One developer
- Packages are tightly coupled by design (workplans depend on adapter-sdk types, skills depend on workplans)
- The interfaces are still being designed — rapid iteration across package boundaries is expected
- None of the packages are yet published to npm

**When multi-repo makes sense:**
- Package interfaces have stabilized
- Different packages have different contributors or consumers
- You want to accept external PRs to `workplane-agent-skills` without granting access to infrastructure code

**Recommendation:** Start in a **monorepo**, migrate to multi-repo when interfaces stabilize.

The migration path is low-risk: move a package directory to a new repo, update cross-package deps from `workspace:*` to versioned npm references, and set up a new CI pipeline. Doing this after v0.3.0 is complete (and interfaces are stable) is far less disruptive than splitting prematurely.

---

## 5. Recommended approach for v0.3.0

**Keep the monorepo. Use Changesets for publication.**

1. Add `workplane-dbos`, `workplane-workplans`, and `workplane-agent-skills` as new packages under `/packages/`.
2. Install `changesets` for versioning and changelog generation.
3. Mark packages as `private: false` in their `package.json` when ready to publish.
4. Publish under the `@workplane` npm scope (or unscoped with the `workplane-` prefix, whichever is available).

### Directory layout after v0.3.0

```
packages/
  adapter-aider/          ← public: "@workplane/adapter-aider"
  adapter-claude-code/    ← public: "@workplane/adapter-claude-code"
  adapter-codex/          ← public: "@workplane/adapter-codex"
  adapter-harness/        ← public: "@workplane/adapter-harness"
  adapter-ollama/         ← public: "@workplane/adapter-ollama"
  adapter-shell/          ← public: "@workplane/adapter-shell"
  adapter-sdk/            ← public: "@workplane/adapter-sdk"
  cli/                    ← public: "@workplane/cli"
  core/                   ← internal (private: true)
  db/                     ← internal (private: true)
  node/                   ← public: "@workplane/node"
  server/                 ← public: "@workplane/server"
  types/                  ← public: "@workplane/types"
  dbos/                   ← public: "@workplane/dbos"
  workplans/              ← public: "@workplane/workplans"
  agent-skills/           ← public: "@workplane/agent-skills"
```

---

## 6. npm package naming

Two conventions are viable:

| Convention | Example | Notes |
|------------|---------|-------|
| Scoped | `@workplane/server`, `@workplane/workplans` | Requires npm org setup; clear namespace ownership |
| Prefixed | `workplane-server`, `workplane-workplans` | No org required; slightly longer names |

**Decision:** Use `@workplane/` for all packages — infrastructure and extensions alike. Consistent scoping makes the relationship between packages immediately obvious on npm, avoids the need to ever remember which packages are scoped and which are not, and the org setup cost is a one-time thing.

---

## 7. Changesets setup

```bash
pnpm add -D -w @changesets/cli
pnpm changeset init
```

Each PR that changes a publishable package includes a `.changeset/*.md` file describing the change level (`major` | `minor` | `patch`). The release CI step runs `pnpm changeset version` and `pnpm changeset publish`.

Reference: `https://github.com/changesets/changesets`

---

## 8. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-28 | Single monorepo, permanent | Tight inter-package coupling; single developer; no split trigger anticipated |
| 2026-05-28 | `@workplane/` scope for all packages | Consistent; no mixed naming; one-time npm org setup cost |
