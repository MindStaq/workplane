# Handing over the high-fidelity prototype

The repository is ready to receive a Next.js / React / TypeScript prototype and turn it into the first Workplane web
app. This page says what to hand over, where it goes, and how it will be converted. Nothing here requires the
prototype to know how Workplane works internally.

## What to hand over

A **source** prototype, not screenshots or a design-tool export:

| Item | Expectation |
|---|---|
| Stack | Next.js (App Router preferred), React, TypeScript. Plain CSS, CSS modules, Tailwind or a component library are all fine; tell us which. |
| Routes | One route per screen, with the same URL structure you want in the product. |
| Components | Reusable pieces separated from page code (buttons, badges, tables, log viewer, forms). |
| Design tokens | Colours, spacing, typography, radii in one place (CSS variables or a theme file). |
| Data | **All mock data behind one module** (for example `data/mock.ts` exporting typed functions such as `listTasks()`), so it can be swapped for real calls in one place. No data literals inside components. |
| States | Every screen shows loading, empty, error and live/active states (see the template). |
| Node version / package manager | Whatever it was built with; the conversion handles the rest. |

Fill in [PROTOTYPE_INTAKE_TEMPLATE.md](./PROTOTYPE_INTAKE_TEMPLATE.md) (a screen-by-screen table). It is how we check, before any
code is written, that the API can feed every screen. Section "Known API gaps" in that file lists what is missing today.

## Where it goes

Drop the prototype into [`design/prototype/`](../../design/prototype/). That folder is excluded from linting, building,
type-checking, the Nx project graph (`.nxignore`) and the pnpm workspace, so it can be reviewed in a PR without affecting CI.
It never ships.

## How it will be converted

1. **Scaffold already exists.** `apps/web` is a working Next.js app (App Router, webpack build) with a server-side proxy to the
   control plane, a polling task list, tests and an end-to-end smoke test. `libs/ui` holds design tokens and a first component.
2. **Screens move into `apps/web`.** Routes and page components are copied over; the placeholder dashboard is replaced.
3. **Tokens and primitives move into `libs/ui`.** The neutral placeholder tokens in `libs/ui/src/tokens.css` are replaced by the
   prototype's tokens. Components used by more than one screen live in `libs/ui`; screen-specific ones stay in `apps/web`.
4. **The mock data module is replaced** by calls to `@workplane/client` (through the `/api/workplane` proxy). Live views poll
   (the task list polls every 3 seconds today); server-sent events can replace polling later without touching components.
5. **Data-fetching library:** not chosen yet. SWR or TanStack Query are the candidates; decide at the first conversion PR.
6. **Styling system:** open decision D6 in the migration plan. The prototype decides it.

## Rules the web app lives by (enforced)

- The browser talks only to the Next.js proxy (`apps/web/app/api/workplane/[...path]`). The operator token is a server-only
  environment variable and is never sent to the browser.
- The proxy forwards only an allow-list of operator routes (`apps/web/src/lib/proxy-policy.ts`). Node-only routes return 403.
- `apps/web` and `libs/ui` may import only `@workplane/types`, `@workplane/client` and `@workplane/ui`. Importing the database,
  core, adapters, `node-pty` or `better-sqlite3` fails lint. Proof: `pnpm check:web-boundaries`.

## Run it locally

```bash
pnpm dev:all            # control plane + one node + web app on http://localhost:3000, with sample data in every state
pnpm dev:all --reset    # same, from a fresh sample database
pnpm test:e2e           # Playwright smoke test against a seeded stack
```

`pnpm dev:all` uses an isolated database at `.workplane/dev/dev.db`; it never touches `~/.workplane`. Ports can be changed with
`WORKPLANE_SERVER_PORT` and `WEB_PORT`.

## API the UI can use today

See [`libs/client`](../../libs/client/README.md) for the typed client. Endpoints added for the UI: `GET /nodes`,
`GET /skills` (with input schemas), `GET /runs/:id/logs?afterId=` (incremental logs), opt-in CORS
(`WORKPLANE_CORS_ORIGINS`) and opt-in authenticated reads (`WORKPLANE_PROTECT_READS=true`).
