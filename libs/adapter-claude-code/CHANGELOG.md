# @workplane/adapter-claude-code

## 0.5.0

### Minor Changes

- 54d4e7b: v0.5.0: Nx workspace, operator API additions, and the groundwork for the web console.

  - The repository is now an Nx workspace (`apps/` and `libs/`). Published packages are built by the same tooling as before and ship the same file lists.
  - New operator endpoints: `GET /nodes`, `GET /skills` (with input schemas) and `GET /runs/:id/logs?afterId=` for incremental log reads.
  - `GET /runs/:id/input` now accepts the operator token as well as the node token.
  - Opt-in CORS (`WORKPLANE_CORS_ORIGINS`) and opt-in authenticated reads (`WORKPLANE_PROTECT_READS=true`).
  - The CLI talks to the control plane through a typed client; its output is unchanged.

### Patch Changes

- Updated dependencies [54d4e7b]
  - @workplane/adapter-harness@0.5.0
