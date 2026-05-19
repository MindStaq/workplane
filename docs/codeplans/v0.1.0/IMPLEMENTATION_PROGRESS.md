# v0.1.0 implementation progress

**Branch:** `docs/versioned-specs-v0.1-fleet` (implementation commits)  
**Updated:** automated run

## Summary

Phases A–E implemented in code: node/operator auth, stable node registration by name, cancellable execution, aider improvements, ollama inference adapter, codex/claude-code harness adapters, CLI commands, unit tests, auth integration test, UAT scripts, `pnpm dev:db`, fleet deployment doc.

## Verify locally

```bash
cp .env.example .env.local
# set DATABASE_URL and tokens in .env.local

pnpm db:migrate
pnpm test
pnpm test:auth
pnpm uat:shell
pnpm uat:inference   # skips if ollama missing
pnpm uat:aider       # skips if aider missing; needs --repo
```

## Phase checklist

| Phase | Status | Notes |
|-------|--------|-------|
| A Fleet auth | Done | `WORKPLANE_NODE_TOKEN`, `WORKPLANE_OPERATOR_TOKEN` |
| B Aider | Done | branch, `--yes`, testCommand, cancel kill |
| C Inference | Done | `adapter-ollama`, CLI, `uat:inference` |
| D Harness | Done | `codex`, `claude-code` batch adapters |
| E Hardening | Done | tests, dev:db, README, `.env.example`, FLEET.md |

## Manual fleet (your morning review)

Two-node Tailscale proof still requires your machines — see [docs/deployment/FLEET.md](../../deployment/FLEET.md).

## Known limits

- Harness UAT not automated (requires real `codex`/`claude` CLIs)
- vLLM adapter deferred (optional in spec)
- Interactive AI clients → v0.2.0
