# Workplane Roadmap

This document captures early-stage ideas for where Workplane could go next. It is a **thinking space, not a
commitment** — nothing here is scheduled, scoped into a version, or guaranteed to ship. For what has actually
shipped, see the root [README.md § Progress](../README.md#progress) and the versioned specs under
[`specs/`](specs/README.md).

Ideas are captured as-is from an internal ideation session and organised by status:

| Status | Meaning |
|---|---|
| **Raw** | Captured and reasoned through, but not yet scoped, sequenced, or committed to a version. |
| **Parked** | Deliberately deferred — interesting, but explicitly not a near-term priority. |

## Contents

- [Active ideas (raw)](#active-ideas-raw)
  - [1. Configurable Remote Executor Personas](#idea-1)
  - [2. Tasklist: Pre-Routing Work Definition](#idea-2)
  - [3. Agent Knowledge Profiles & Scoped Workspaces](#idea-3)
  - [4. Shared Storage Layer for Cross-Task Asset Continuity](#idea-4)
  - [5. Interactive Agent Session Protocol — A Standards Proposal](#idea-5)
  - [6. Interactive Agent Sessions — Implementation Path](#idea-6)
  - [8. Iroh/Mesh LLM as a Local Inference Executor Target](#idea-8)
- [Parked ideas](#parked-ideas)
  - [7. Psyche/NousNet Node Executor — Generality Demonstration](#idea-7)

---

## Active ideas (raw)

<a id="idea-1"></a>

### 1. Configurable Remote Executor Personas

**Status:** Raw · **Tags:** `executors`, `configuration`, `routing`

**Concept**

A first-class configuration system for remote work executors (e.g. Codex, Claude Code) that defines how they
behave when assigned tasks involving a codebase — analogous to how an employee has a specialized role and
working style. The system goes well beyond simple prompt templating; it encodes a rich "workstyle" for each
executor.

**Motivation**

Workplane's core thesis is intelligent routing — the right execution target for each step. This extends that
idea one layer up: not just "which executor?" but "which version of that executor, configured for this
context?" A task routed to Claude Code for QA review should behave fundamentally differently than the same
executor routed for feature implementation.

**Details**

- What parts of the repo to pay attention to (test files vs. source vs. infra)
- What kinds of outputs to produce (test plans, diffs, PRs, docs, inline comments)
- How to escalate uncertainty vs. make autonomous decisions
- What tools or sub-agents to invoke at each stage of execution
- Style/conventions specific to the codebase or team

**Open questions**

- Static config file (e.g. `.workplane/executor.yaml`) or dynamic per-task capability?
- Relationship to the existing skills concept — "skills for remote executors" or orthogonal?
- Should personas be composable (e.g. "QA persona" + "strict style enforcer" layered)?
- Right level of abstraction — too high = just a system prompt, too low = reimplementing agent scaffolding

**Possible names:** Executor Profiles, Executor Roles, Agent Personas, Workstyles

---

<a id="idea-2"></a>

### 2. Tasklist: Pre-Routing Work Definition

**Status:** Raw · **Tags:** `ui`, `tasklist`, `planning`, `workplan`

**Concept**

A structured Tasklist feature that lets you define, organise, and refine work before it's ready to be routed
to any executor or agent. This is the planning layer that sits upstream of routing — the moment where intent
becomes an actionable workplan. It's also the first concrete feature anchor for a Workplane UI.

**Motivation**

Routing is only as good as the work definition it receives. Right now there's no first-class place to break
down a goal into discrete, routable tasks before dispatch. The Tasklist fills that gap — it's the interface
where a human (or an orchestrator) structures work into units that Workplane can reason about, assign, and
track. It makes Workplane a full loop: define → route → execute, rather than just route → execute.

**Details**

- Create and organise tasks before committing them to any executor
- Attach metadata per task: estimated complexity, preferred executor type, dependencies on other tasks
- Support manual decomposition as well as AI-assisted breakdown of a high-level goal
- Tasks in the list are in a "draft" or "ready" state — routing only happens when explicitly triggered
- Becomes the primary surface of the Workplane UI, giving users visibility into their full workplan at a glance

**Open questions**

- What is the unit of a "task" — is it a step in a skill, a GitHub issue, a free-form description, or all of the above?
- Should the Tasklist be persistent (saved across sessions) or ephemeral per workplan run?
- How does it relate to the workplan graph — is it a flat list that compiles into a DAG, or does it expose the DAG directly?
- Who can populate it — human only, or can an agent propose tasks into the list for human review before routing?
- Where does this live in the broader Workplane UI — as a sidebar, a dedicated view, a canvas?

**Possible names:** Tasklist, Work Queue, Workplan Draft, Dispatch Board, Pre-flight

---

<a id="idea-3"></a>

### 3. Agent Knowledge Profiles & Scoped Workspaces

**Status:** Raw · **Tags:** `knowledge`, `context`, `workspaces`, `confidentiality`, `specialization`

**Concept**

A knowledge and context management layer that allows each executor on a machine (Hermes, Claude Code, etc.)
to be pre-configured with specialised knowledge, history, and domain context — turning it into an expert
executor for a particular subset of tasks. Critically, this knowledge is scoped: different executors can have
access to different knowledge, and that scoping can be enforced for confidentiality, client separation, or
role-based reasons.

**Motivation**

Right now there is no way to compartmentalise knowledge at scale. Most agent setups put everything in one
place — one context, one knowledge base, one history. Sometimes that is fine, but it breaks down quickly. If
you are doing consulting work across multiple clients, or running different workstreams that should not bleed
into each other, you need a concept of a workspace: a scoped container of knowledge that an executor can draw
on while executing tasks, but that is strictly isolated from other workspaces. This is both a capability
feature (specialisation makes executors better) and a trust and compliance feature (isolation makes them safe
to use across contexts).

**Details**

- Each executor instance can be associated with one or more Knowledge Profiles
- A profile bundles: codebase context, domain terminology, project history, relevant docs, tool preferences
- Profiles are scoped — an executor running in Client A workspace cannot access knowledge from Client B workspace
- Workspaces become the top-level organisational primitive: a workspace owns tasks, executors, knowledge, and history
- Supports use cases: client consulting isolation, internal team separation, personal vs. work contexts
- Knowledge can be bootstrapped manually (upload docs, paste context) or indexed automatically from a repo or file system

**Open questions**

- Is a workspace the right top-level concept, or is it a property of a knowledge profile?
- How is profile freshness maintained — manual updates, automated re-indexing, or event-triggered?
- Can profiles be shared or transferred across machines, or are they strictly local?
- Does this need versioning for reproducibility (this task was run against Profile v1.3)?
- How does workspace scoping interact with executor personas ([#1](#idea-1)) — are they layered, or merged into one config?
- What is the enforcement model for isolation — soft (routing logic) or hard (OS-level sandboxing)?

**Possible names:** Knowledge Profiles, Scoped Workspaces, Context Packs, Expert Profiles, Domain Contexts

---

<a id="idea-4"></a>

### 4. Shared Storage Layer for Cross-Task Asset Continuity

**Status:** Raw · **Tags:** `storage`, `workspaces`, `files`, `repositories`, `continuity`

**Concept**

A shared storage layer that allows tasks and workspaces to access common assets — such as the same code
repository or file set — when that sharing is explicitly desired. This sits alongside the isolated workspace
model as an opt-in alternative: isolation by default, shared access by choice.

**Motivation**

Workplane already executes work in dedicated, isolated folders and file areas per task. That isolation is a
feature — it prevents tasks from interfering with each other. But it creates a problem when multiple tasks
legitimately need to work on the same assets, such as a shared codebase. Without a shared storage layer, each
task gets its own copy, which means duplicated state, no continuity between runs, and wasted resources. The
question becomes: can work continue across tasks when the same assets are involved, in cases where that
behaviour is explicitly desired?

**Details**

- Isolated workspaces remain the default — shared storage is opt-in per task or per workspace
- A shared storage layer would let multiple tasks mount the same repository or file tree as a common asset
- Enables continuity: a task can pick up where a previous one left off on the same codebase without re-cloning or re-staging
- Shared assets could include: git repositories, document stores, build artefacts, dependency caches
- Access control matters — shared does not mean uncontrolled; tasks can share assets while still having separate execution contexts
- Could be implemented as a mounted volume, a content-addressed store, or a sync layer depending on the consistency requirements

**Open questions**

- What is the consistency model — can two tasks write to a shared asset simultaneously, or is it read-shared/write-isolated?
- How does this interact with workspace scoping ([#3](#idea-3)) — can a shared asset span workspaces, or only tasks within the same workspace?
- Is this a Workplane primitive or something delegated to the OS/container layer (e.g. bind mounts, overlayfs)?
- How do you signal to Workplane that a task wants shared vs. isolated access to a given asset?
- What happens on conflict — if two tasks modify the same file in a shared repo, who wins? (Answer: git branching — each task gets its own branch, and conflicts surface at MR time, not at execution time)

**Git branching note**

For repository assets specifically, git already provides the concurrency model: each task works on a
dedicated branch following a consistent naming convention (e.g. `workplane/<task-id>/<description>`), and all
work is submitted as an MR by default. This should be the standard behaviour in both isolated and shared
storage modes — not an edge case. Shared storage doesn't mean shared writes to the same branch; it means
shared access to the same underlying repo, with git handling divergence naturally. This eliminates the need
for any custom locking or queuing mechanism for repo-based assets.

**Possible names:** Shared Storage, Asset Layer, Common Mounts, Shared Workdir, Persistent Asset Store

---

<a id="idea-5"></a>

### 5. Interactive Agent Session Protocol — A Standards Proposal

**Status:** Raw · **Tags:** `protocol`, `standards`, `claude-code`, `pty`, `human-in-the-loop`, `mcp`, `a2a`

**Concept**

A proposal for a standard protocol that enables orchestrators like Workplane to establish real-time,
interactive sessions with remote coding agents like Claude Code or Codex — including the ability to route
questions and responses to a human in the loop in real time. This is currently a gap in both MCP and A2A; no
existing standard covers it. Workplane is in a position to propose one.

**Motivation**

Claude Code already supports a compelling remote control mode: when paired with the mobile app, it can
surface questions and await human responses in real time during execution. This is powerful, but it is not a
protocol — it is a proprietary implementation. On the Workplane side, the current approach to agent
integration is stdout/stdin piping over CLI commands, which is slow, lossy, and fundamentally not designed
for interactive sessions. There is a tech debt item open around replacing this with `node-pty` to create a
proper PTY session. But the deeper question is: should this be a standard? If Workplane could propose a
lightweight interactive agent session protocol to the relevant committees — MCP, A2A, or a new working group
— it could become the interoperability layer that tools like Workplane, Claude Code, Codex, and future agents
all speak natively.

**Details**

- Current Workplane approach: stdout/stdin piping via CLI — functional but slow, no interactivity, no real-time feedback
- Tech debt item: replace with `node-pty` to get a proper PTY session and terminal emulation layer
- Claude Code's mobile remote control is the closest existing implementation — real-time Q&A between agent and human during a live run
- Neither MCP (Model Context Protocol) nor A2A (Agent-to-Agent) currently defines a standard for this kind of interactive, stateful agent session
- A proposed standard could define: session initiation, message framing, human-interrupt signals, stdin/stdout/stderr multiplexing, and graceful termination
- Workplane's position as an orchestrator that integrates multiple agent types makes it a credible proposer — it has the cross-agent perspective that a single vendor wouldn't

**Open questions**

- Is this MCP territory (tool/model communication), A2A territory (agent-to-agent), or something new entirely — an "orchestrator-to-agent" layer?
- What is the minimum viable protocol surface? (session open/close, message framing, interrupt signal, human-in-the-loop pause/resume seem like the core)
- Does `node-pty` solve the immediate Workplane need well enough to ship, while the standards work happens in parallel?
- Who are the right protocol committees or working groups to approach — and is this an RFC, a GitHub proposal, or a blog post that attracts collaborators?
- Could this be Workplane's open-source contribution that earns community credibility beyond just the core engine?
- How does the human-in-the-loop pause/resume interact with the Tasklist ([#2](#idea-2)) — should a blocked agent surface its question into the Tasklist UI?

**Possible names:** Agent Session Protocol, Interactive Agent Interface, Orchestrator-Agent Protocol, OAP, Live Agent Channel

**Cross-reference:** See idea [#6](#idea-6) for the near-term implementation counterpart. A working Workplane
implementation of MCP Tasks + Elicitation ([#6](#idea-6)) is what gives this standards proposal its
credibility and standing. The two ideas have different time horizons: [#6](#idea-6) is weeks, [#5](#idea-5)
is months.

---

<a id="idea-6"></a>

### 6. Interactive Agent Sessions — Implementation Path

**Status:** Raw · **Tags:** `mcp`, `node-pty`, `tech-debt`, `elicitation`, `tasks`, `implementation`

**Concept**

A focused implementation decision for Workplane: how to replace the current slow stdin/stdout piping approach
with a proper interactive session layer for coding agents like Claude Code. The MCP protocol already has the
relevant primitives — Tasks (SEP-1686) and Elicitation — but no real coding agent currently implements them.
Workplane has an opportunity to be the first orchestrator that wires this up end-to-end.

**Motivation**

Workplane currently communicates with agents by piping stdout/stdin over CLI commands. This is functional but
slow, lossy, and fundamentally stateless — it cannot support real-time human-in-the-loop responses, mid-run
interrupts, or long-running task state. There is an open tech debt item to replace this with `node-pty` for a
proper PTY session. The MCP research for idea [#5](#idea-5) surfaced that the protocol already has two
directly relevant primitives: Elicitation (server pauses and requests structured human input mid-execution,
over a Streamable HTTP + SSE channel) and Tasks/SEP-1686 (long-running async work with an `input_required`
state for interactive pauses and reconnection by task ID). Critically, as of the MCP Dev Summit in April
2026, no off-the-shelf agent — including Claude Code, Claude Desktop, or Goose — actually implements the
Tasks protocol yet. Workplane could be the first orchestrator to do so.

**Details**

- Current state: stdout/stdin piping — slow, no interactivity, no real-time feedback, no reconnection
- Tech debt item: replace with `node-pty` for proper PTY session and terminal emulation
- MCP Elicitation (June 2025 spec): server pauses mid-tool-execution, pushes a structured prompt to the client over SSE, client responds, server resumes — exactly the human-in-the-loop pattern needed
- MCP Tasks SEP-1686: fire-and-forget long-running work with `input_required` state; clients can reconnect and resume by task ID
- SEP-2663 (Tasks Extension, in progress): redesigning client-hosted tasks which were broken by SEP-2260; worth tracking before building against it
- No production coding agent implements Tasks yet — Workplane building this first is a meaningful open-source contribution and a credibility move
- `node-pty` solves the immediate local PTY need; MCP Tasks+Elicitation solves the remote/networked agent case — these are complementary, not competing

**Open questions**

- Ship `node-pty` first for the immediate local case, then layer MCP Tasks on top for remote agents — or try to unify from the start?
- Should Workplane build its own MCP client that speaks Tasks+Elicitation, or wrap an existing SDK?
- SEP-2663 is actively redesigning Tasks — is the spec stable enough to build against now, or wait for the 2026-07-28 release candidate to land?
- If Claude Code doesn't support MCP Tasks natively, does Workplane need to wrap Claude Code in a shim MCP server that translates?
- How does the Elicitation interrupt surface in the Workplane UI — does a blocked agent push its question into the Tasklist ([#2](#idea-2))?

**Possible names:** Agent Session Layer, MCP Task Bridge, Interactive Execution Layer, PTY + Tasks

**Cross-reference:** This is the implementation counterpart to idea [#5](#idea-5) (standards proposal).
Solving [#6](#idea-6) with a working Workplane implementation is what earns the standing to propose
[#5](#idea-5) to protocol committees. See also: MCP roadmap "Result Type Improvements" (streaming) and
"Triggers and Event-Driven Updates" as adjacent work to watch.

---

<a id="idea-8"></a>

### 8. Iroh/Mesh LLM as a Local Inference Executor Target

**Status:** Raw · **Tags:** `executors`, `routing`, `inference`, `p2p`, `iroh`, `local-models`

**Concept**

A proposal for Workplane to treat a local Mesh LLM node (built on iroh) as a first-class executor target —
enabling Workplane's routing layer to dispatch appropriate tasks to a peer-to-peer local inference mesh
rather than exclusively to cloud APIs. Iroh is a production-ready P2P networking library (just hit 1.0) that
provides authenticated, NAT-traversing QUIC connections between devices addressed by public key. Mesh LLM
builds on top of it to pool GPUs across machines into a single OpenAI-compatible API, with support for
layer-split inference across multiple modest nodes. The two layers — Workplane's task routing and Mesh LLM's
inference routing — are genuinely complementary and sit at different levels of the stack.

**Motivation**

Workplane's core thesis is routing tasks to the right executor — and "right" should include cost, privacy,
latency, and control, not just capability. Cloud LLM APIs are the obvious default, but they are not always
the best answer: they are metered, they send data off-machine, and they are someone else's infrastructure. A
local inference mesh changes the calculus significantly. Mesh LLM (published July 2026) demonstrates this
concretely: it pools existing GPUs across machines, exposes an OpenAI-compatible endpoint at
`localhost:9337/v1`, and handles the routing between nodes internally — including splitting large models
across several machines via its "Skippy" pipeline mode. From Workplane's perspective, this is just another
executor target. The routing decision becomes: send this task to Claude API, send that one to a local Mesh
LLM node. The business logic for that decision (task sensitivity, cost envelope, latency tolerance, model
capability required) is exactly what Workplane's routing layer is designed to encode.

**Details**

- Mesh LLM exposes an OpenAI-compatible HTTP API at `localhost:9337/v1` — minimal integration surface for a Workplane executor persona
- Iroh underpins the Mesh LLM network: every node is addressed by a public key, with authenticated QUIC connections handling gossip, inference routing, and activation streaming between pipeline stages
- Mesh LLM already exposes capabilities over MCP — a direct integration point for Workplane's [#6](#idea-6) MCP session layer work
- Mesh LLM's plugin architecture and gossip protocol (capability announcements include models, GPU specs, and RTT) could inform how Workplane discovers and selects executor targets dynamically
- Iroh is also the networking substrate under Psyche/NousNet ([#7](#idea-7)) — understanding it is relevant groundwork for both integration directions
- Tandemn (another iroh-ecosystem project) is specifically "iroh for tensors, used for inference over heterogeneous GPUs" — a second data point that this is becoming a real executor category
- Mesh LLM's roadmap includes speaking ACP (agent communication protocol), increasing the long-term surface area for Workplane integration

**Open questions**

- What is the routing heuristic? How does Workplane decide which tasks go to a local inference node vs. a cloud API — by model capability, task sensitivity tag, cost budget, or all three?
- Is a "local-inference" executor persona a single type, or does Workplane need to distinguish between Mesh LLM, Ollama, vLLM, and other local serving backends?
- Does iroh's public-key-addressed connection model offer anything useful for Workplane's executor identity layer — or is this purely a transport detail Workplane doesn't need to care about?
- Should Workplane use Mesh LLM's MCP endpoint directly (via the [#6](#idea-6) session layer) or wrap the OpenAI-compatible HTTP endpoint as a simpler first integration?
- Community angle: Mesh LLM, iroh, and Psyche are all in adjacent open-source communities with HN presence — is there a joint narrative or cross-post opportunity worth timing?

**Possible names:** Local Inference Executor, Mesh LLM Target, P2P Inference Routing, iroh Executor Bridge

**Cross-reference:** Connects to [#1](#idea-1) (Executor Personas — a `mesh-llm` executor type is a natural
new persona), [#6](#idea-6) (MCP Session Layer — Mesh LLM exposes MCP and plans ACP support, making it a test
case for the interactive session work), and [#7](#idea-7) (Psyche/NousNet — iroh is also Psyche's networking
substrate, so understanding iroh pays dividends in both directions). Iroh 1.0 shipped June 2026; Mesh LLM
published July 2026 — the ecosystem is live and active.

---

## Parked ideas

<a id="idea-7"></a>

### 7. Psyche/NousNet Node Executor — Generality Demonstration

**Status:** Parked · **Tags:** `executors`, `generality`, `gpu`, `distributed-training`, `demo`

**Concept**

A demonstration of Workplane's executor model generalising beyond AI coding agents to raw compute workloads —
specifically, managing Psyche (NousNet) distributed training nodes as first-class executor targets. A Psyche
training node is a long-running, GPU-bound process managed by a run-manager binary and coordinated via
Solana. Workplane would treat this as just another executor type: provisioned, configured, monitored, and
lifecycle-managed through the same routing and orchestration primitives used for Claude Code or Codex.

**Motivation**

Workplane's core thesis is intelligent task routing to the right execution target — and that thesis should
not be limited to LLM-based coding agents. Psyche is a peer-to-peer distributed training protocol (built by
Nous Research / PsycheFoundation) where untrusted parties contribute GPU compute to collaboratively train
open transformer models, with coordination and reward settlement handled on-chain via Solana. Joining a
Psyche run today is a manual, error-prone process: configure a `.env` file, manage Docker and NVIDIA
Container Toolkit, handle wallet keypairs per machine, and babysit a long-running binary. Workplane can own
that entire lifecycle. This is not a core product feature — it is a deliberate generality demonstration,
proving that Workplane's executor and workspace primitives apply to compute orchestration broadly, not just
to agentic coding tasks. It is also a credible open-source contribution to the Psyche ecosystem and a
narrative asset for positioning Workplane as infrastructure-layer rather than a narrow coding tool.

**Details**

- Define a `psyche-node` executor type in Workplane — a long-running executor backed by the run-manager binary rather than an LLM agent
- Executor persona config encodes: wallet keypair path, RPC endpoints, run ID, `DATA_PARALLELISM`, `TENSOR_PARALLELISM`, `MICRO_BATCH_SIZE`, `NVIDIA_DRIVER_CAPABILITIES`
- Workplane manages node lifecycle: start, stop, restart on crash, log streaming, health checks
- Psyche's multi-machine delegation model (one master keypair, one delegate keypair per machine) maps naturally onto Workplane's workspace isolation — each machine gets its own scoped workspace with its own identity
- Workplane can manage enrollment of multiple machines into a Psyche run from a single control plane, eliminating the manual per-machine setup
- Long-running process monitoring (not task-per-request) is a new executor mode this surfaces — worth designing cleanly as a general primitive

**Open questions**

- Does Workplane need a "long-running service" executor mode distinct from the "task" executor mode — or is a Psyche node just a task that never terminates?
- How does Workplane surface Psyche node health and training progress — as task status, or as a separate monitoring channel?
- Should wallet/keypair management be handled by Workplane's workspace identity layer, or left to the operator?
- Is there a multi-run scheduling angle worth exploring — Workplane routing GPU cycles across Psyche runs based on configurable criteria (reward rates, model preferences)?
- At what point does this get built — after core coding agent use case is solid, or earlier as a community/narrative play?

**Possible names:** Psyche Node Executor, Distributed Training Target, GPU Compute Executor, NousNet Integration

**Cross-reference:** Connects to [#1](#idea-1) (Executor Personas — `psyche-node` is a new persona type),
[#3](#idea-3) (Scoped Workspaces — delegate keypair-per-machine isolation maps onto workspace scoping), and
the `ipkvm://` bare-metal executor target concept (Psyche requires raw NVIDIA GPU access, making it a natural
bare-metal workload). This is intentionally scoped as a future demonstration, not a near-term roadmap item.

---

_Have an idea to add? Append it to the relevant section above, following the same format (Concept /
Motivation / Details / Open questions / Possible names), and cross-link it to any related ideas._
