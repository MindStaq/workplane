# Archived: WORKPLANE_SPEC v0.0 (original monolith)

**Deprecated.** Use [specs/v0.1.0/WORKPLANE_SPEC.md](../../specs/v0.1.0/WORKPLANE_SPEC.md).

This file is the pre-versioning specification (~2100 lines). It remains valuable as an **appendix** for:

- Detailed REST API (§17)
- CLI command reference (§16)
- Adapter interface sketches (§13)
- DBOS workflow examples (§21)
- Package layout (§20)

**Key deltas in v0.1.0 (do not follow v0.0 for these):**

| Topic | v0.0 original | v0.1.0 |
|-------|---------------|--------|
| Primary deployment | Often read as single-machine | **Personal multi-node fleet** |
| Claude Code | Non-goal | **Batch harness** in scope |
| Local inference | Non-goal / future | **In scope** (Ollama/vLLM) |
| Node auth | Specified, not required for local | **Required** for v0.1.0 done |
| Interactive PTY | Mentioned in spec | **v0.2.0** only |
