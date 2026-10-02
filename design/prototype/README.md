# Prototype landing area

Drop the high-fidelity Next.js / React / TypeScript prototype here (see `docs/design/README.md`).

This directory is deliberately outside the build: it is not part of the pnpm workspace, it is ignored by ESLint and by the Nx
project graph (`.nxignore`), and the root TypeScript configuration does not include it. Adding files here cannot break CI and
nothing here is ever published.
