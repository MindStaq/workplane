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

## How it was converted

The first prototype (`workplane-ui-design.zip`, a v0.app export) has been converted. The raw export is in `design/prototype/` and the
screen-by-screen record, including every API gap it exposed, is [`design/prototype/INTAKE.md`](../../design/prototype/INTAKE.md).

- **Screens** are in `apps/web/app/**` (thin pages) and `apps/web/src/components/**` (screen components). Each page calls one loader in
  `apps/web/src/lib/data.ts`.
- **Tokens and primitives** are in `libs/ui`: `src/tokens.css` (palette and Tailwind `@theme` mapping), `src/components/*` (shadcn/ui
  primitives), `src/workplane/primitives.tsx` (layout pieces) and `StatusBadge`. Components used by more than one screen live there;
  anything that knows about tasks, runs or the API stays in `apps/web`.
- **Data:** the mock module is gone. Server components read the control plane through `@workplane/client` with the server-only operator
  token. Browser code (submit, cancel, schedule actions, incremental logs) uses the same client through the `/api/workplane` proxy.
- **Live views** poll: `AutoRefresh` re-runs the server components every 5 seconds (paused in hidden tabs) and the run console polls
  `GET /runs/:id/logs?afterId=` every 1.5 seconds while the run is live. Server-sent events can replace both later.
- **Styling (D6):** Tailwind CSS v4 + shadcn/ui. `apps/web/app/globals.css` imports Tailwind, `tw-animate-css` and `libs/ui/src/tokens.css`,
  and adds `@source` for `libs/ui` so classes used in the shared components are generated.
- **Data fetching (D8):** no SWR or TanStack Query; server components plus `router.refresh()`.

### Adding or updating a shadcn component

Generate it with the shadcn CLI in a scratch project, copy the file into `libs/ui/src/components/`, replace the `@/` imports with
relative `./x.js` and `../lib/utils.js` imports, and export it from `libs/ui/src/index.ts`. If the CLI changes
`tailwind.css`, re-vendor `libs/ui/src/shadcn.css` (the header names the version).

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
pnpm test:e2e           # Playwright tests against a seeded stack (17 tests)
```

`pnpm dev:all` uses an isolated database at `.workplane/dev/dev.db`; it never touches `~/.workplane`. Ports can be changed with
`WORKPLANE_SERVER_PORT` and `WEB_PORT`.

## API the UI can use today

See [`libs/client`](../../libs/client/README.md) for the typed client. Endpoints added for the UI: `GET /nodes`,
`GET /skills` (with input schemas), `GET /runs/:id/logs?afterId=` (incremental logs), opt-in CORS
(`WORKPLANE_CORS_ORIGINS`) and opt-in authenticated reads (`WORKPLANE_PROTECT_READS=true`).
