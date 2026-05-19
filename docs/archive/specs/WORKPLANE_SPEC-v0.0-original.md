> **DEPRECATED** — Superseded by [specs/v0.1.0/WORKPLANE_SPEC.md](../../specs/v0.1.0/WORKPLANE_SPEC.md).  
> Kept as reference appendix. Do not update this file for new product decisions.

# Workplane 0.1.0 Specification (archived v0.0 draft)

## 1. Summary

**Workplane** is an open-source, TypeScript-first durable execution plane for routing work to capable nodes across a trusted private network.

It uses **DBOS TypeScript** and **Postgres** for durable workflow state, and an **adapter layer** to execute specific kinds of work.

The first high-value use case is agentic work:

- run shell commands
- clone repositories
- invoke Aider
- eventually invoke Claude Code, OpenHands, local inference engines, and other agent harnesses

The 0.1.0 MVP focuses on a narrow foundation:

> Submit a durable work item, route it to a capable node, execute it through a shell or Aider adapter inside a clean workspace, capture logs and artifacts, persist state through DBOS/Postgres, and report final status.

---

## 2. Positioning

Workplane is **not** a full Temporal replacement.

Workplane is also **not** just an AI-agent runner.

It is a durable routing and execution plane for trusted compute nodes, with agentic work as the first adapter family.

### 2.1 What Workplane Is

Workplane is:

- a TypeScript-first durable execution framework
- a DBOS-backed work orchestration layer
- a private-network-friendly node routing system
- a capability-based task dispatcher
- an adapter-driven execution framework
- a foundation for durable AI agent jobs
- a foundation for future automation, inference, build, test, and CI-style workloads

### 2.2 What Workplane Is Not

Workplane is not:

- a complete workflow-engine competitor to Temporal
- a Kubernetes replacement
- a CI/CD platform in 0.1.0
- a remote desktop or SSH session manager
- a model-serving framework
- a replacement for DBOS
- a replacement for Aider, Claude Code, OpenHands, or other agent harnesses
- a general-purpose distributed operating system
- a multi-tenant SaaS control plane in 0.1.0

---

## 3. Product Framing

### 3.1 Tagline

> **A durable execution plane for routing work across trusted nodes.**

Alternative tagline:

> **Route agentic work, shell tasks, and automation jobs across your own machines.**

### 3.2 README Pitch

Workplane lets you route durable work items to capable nodes across your own machines.

```bash
workplane task submit aider \
  --repo git@github.com:your-org/your-app.git \
  --prompt "Fix the failing tests in the billing module"
```

Workplane will:

- create a durable task
- route it to a capable node
- clone the repository into a clean workspace
- invoke the selected adapter
- capture logs and artifacts
- report status
- allow retries

Workplane is TypeScript-first, DBOS-backed, and designed for private machine networks using Tailscale, Headscale, WireGuard, or LAN-based nodes.

---

## 4. Core Vocabulary

Workplane should use broad execution-plane terminology rather than agent-specific terminology.

| Term | Meaning |
|---|---|
| **Node** | A trusted machine or process capable of executing work |
| **Task** | A requested unit of work |
| **Run** | One execution attempt for a task |
| **Step** | A durable unit of work inside a run |
| **Adapter** | Code that knows how to execute a specific type of work |
| **Capability** | A node skill, tool, runtime, platform, or resource |
| **Artifact** | Output produced by a run |
| **Workspace** | Isolated per-run working directory |
| **Control Plane** | API/server layer that accepts tasks, tracks state, and coordinates nodes |

Older terminology:

| Old term | New term |
|---|---|
| Worker | Node |
| Runner | Adapter |
| AgentGrid | Workplane |

---

## 5. Goals for 0.1.0

The first version should prove the core architecture with minimal scope.

### 5.1 Primary Goals

0.1.0 should support:

1. TypeScript-based control plane
2. DBOS TypeScript integration
3. Postgres as the durable execution backend
4. Node registration
5. Node heartbeat
6. Capability-based task routing
7. Task submission
8. Run creation and tracking
9. Shell adapter
10. Git checkout helper
11. Aider adapter
12. Per-run workspace creation
13. Log capture
14. Artifact capture
15. Basic retry support
16. CLI for starting server, starting nodes, submitting tasks, viewing logs, and inspecting runs

### 5.2 Secondary Goals

If feasible, 0.1.0 may also include:

- Docker-based execution mode
- diff artifact generation for repository changes
- optional test command after agent execution
- basic GitHub branch push
- task cancellation
- simple local dashboard
- environment-variable allowlist

### 5.3 Non-Goals for 0.1.0

0.1.0 will not attempt to include:

- full Temporal-compatible workflow semantics
- SQLite as a distributed backend
- Kubernetes-native scheduling
- multi-language SDKs
- multi-user RBAC
- multi-tenant SaaS deployment
- built-in model serving
- distributed inference
- Claude Code adapter
- OpenHands adapter
- full GitHub App integration
- secrets-manager integrations
- policy-as-code
- advanced approvals
- plugin marketplace
- webhooks
- scheduled jobs
- complex dashboard

---

## 6. Design Principles

### 6.1 Work First, Agents Through Adapters

The core primitive is **work**, not **agents**.

An agent task is one kind of work.

Example work item:

```json
{
  "kind": "agent.run",
  "adapter": "aider",
  "repo": "git@github.com:org/app.git",
  "prompt": "Fix the failing tests"
}
```

Another work item:

```json
{
  "kind": "shell.exec",
  "adapter": "shell",
  "command": "npm test"
}
```

Future work items might include:

```json
{
  "kind": "inference.batch",
  "adapter": "vllm",
  "dataset": "evals/regression.jsonl"
}
```

### 6.2 Adapter-Driven Execution

Workplane Core should not know how to run every kind of workload.

Instead, execution-specific behavior belongs in adapters.

Initial adapters:

- `shell`
- `aider`

Future adapters:

- `claude-code`
- `openhands`
- `docker`
- `node`
- `python`
- `ollama`
- `vllm`
- `exo`
- `github-pr`

### 6.3 Durable by Default

Workplane should persist meaningful task and run state so failures can be inspected, retried, or resumed.

Durable state includes:

- task metadata
- run metadata
- node assignment
- step status
- logs
- artifacts
- errors
- retry count
- start and end timestamps

### 6.4 Node Routing by Capability

Nodes advertise capabilities.

Tasks declare required capabilities.

Workplane routes tasks to nodes whose capabilities satisfy the task requirements.

Example node:

```json
{
  "id": "node_mac_mini_01",
  "name": "Mac Mini Office",
  "capabilities": ["shell", "git", "node", "typescript", "aider", "macos"]
}
```

Example task:

```json
{
  "adapter": "aider",
  "requires": ["git", "aider"]
}
```

### 6.5 Local-First, Network-Secure

Workplane is designed for private trusted networks.

Recommended network layers:

- Tailscale
- Headscale
- WireGuard
- private LAN

Workplane should not require public inbound ports on nodes.

### 6.6 Secure by Design

AI agents and automation commands can be risky.

Each run should execute with:

- a dedicated workspace
- limited filesystem access
- explicit environment variables
- controlled credentials
- captured logs
- artifact tracking
- no default access to the user's home directory
- optional Docker isolation

### 6.7 Small Core, Extensible Adapters

The core should remain small.

Adapter-specific behavior should remain outside the core.

```text
workplane-core
  - tasks
  - runs
  - nodes
  - capabilities
  - routing
  - logs
  - artifacts
  - DBOS workflows

adapters
  - shell
  - aider
  - future agent adapters
  - future inference adapters
```

---

## 7. High-Level Architecture

```text
CLI / API / Dashboard
        |
        v
Workplane Control Plane
        |
        v
DBOS TypeScript
        |
        v
Postgres
        |
        v
Node Pool
        |
        +--> Node A: shell / git / Aider
        +--> Node B: Node.js / TypeScript / test jobs
        +--> Node C: Python / build jobs
        +--> Node D: future GPU / inference jobs
```

### 7.1 Major Components

#### Control Plane

The control plane receives task requests, starts durable DBOS workflows, tracks status, assigns runs to nodes, and exposes APIs/CLI commands.

#### DBOS Workflow Layer

DBOS provides durable execution using Postgres.

Workplane workflows should be written as DBOS workflows and steps.

#### Postgres

Postgres is the primary durable backend for 0.1.0.

It stores:

- DBOS workflow state
- task records
- run records
- node records
- step records
- log references
- artifact references

#### Nodes

Nodes are long-running processes installed on trusted machines.

A node:

- registers with the control plane
- advertises capabilities
- polls for tasks
- creates workspaces
- invokes adapters
- streams or uploads logs
- reports run status

#### Adapters

Adapters execute specific work types.

Initial adapters:

- `shell`
- `aider`

---

## 8. Storage and Persistence

### 8.1 Primary Backend

0.1.0 will use:

```text
DBOS TypeScript + Postgres
```

Postgres is required for distributed multi-node execution.

### 8.2 SQLite Decision

SQLite is not a primary backend for 0.1.0.

SQLite may be considered later for:

- single-machine development mode
- local-only execution
- node-local cache
- artifact metadata
- temporary logs

Distributed orchestration will require Postgres.

### 8.3 Storage Modes

Long-term storage modes may include:

| Mode | Backend | Purpose |
|---|---|---|
| Development mode | SQLite or local Postgres | Easy local experimentation |
| Production/private-network mode | Postgres | Distributed node coordination |
| Node cache | SQLite | Local non-authoritative metadata |
| Artifact store | Filesystem initially | Logs, diffs, generated outputs |

For 0.1.0:

```text
Required:
- Postgres

Optional:
- filesystem artifact store

Future:
- SQLite local-only mode
```

---

## 9. Core Data Model

### 9.1 Task

A task represents one requested unit of work.

```json
{
  "id": "task_01HXYZ",
  "name": "Fix failing tests",
  "kind": "agent.run",
  "adapter": "aider",
  "status": "queued",
  "repo": "git@github.com:org/project.git",
  "branch": "workplane/task_01HXYZ",
  "prompt": "Fix the failing tests in the billing module.",
  "requires": ["git", "aider", "node"],
  "createdAt": "2026-05-17T15:30:00Z",
  "updatedAt": "2026-05-17T15:30:00Z"
}
```

### 9.2 Node

A node represents a trusted machine or process capable of executing work.

```json
{
  "id": "node_mac_mini_01",
  "name": "Mac Mini Office",
  "status": "online",
  "hostname": "mac-mini-office",
  "capabilities": ["shell", "git", "node", "typescript", "aider", "macos"],
  "resources": {
    "cpuCores": 10,
    "memoryGb": 32,
    "gpu": false
  },
  "lastHeartbeatAt": "2026-05-17T15:31:00Z"
}
```

### 9.3 Run

A run represents one execution attempt for a task.

A task may have multiple runs if it is retried.

```json
{
  "id": "run_01HXYZ",
  "taskId": "task_01HXYZ",
  "nodeId": "node_mac_mini_01",
  "status": "running",
  "attempt": 1,
  "startedAt": "2026-05-17T15:32:00Z",
  "endedAt": null
}
```

### 9.4 Step

A step represents a durable unit of work inside a run.

Examples:

- `create-workspace`
- `checkout-repo`
- `install-dependencies`
- `run-adapter`
- `run-tests`
- `capture-diff`
- `collect-artifacts`

```json
{
  "id": "step_01HXYZ",
  "runId": "run_01HXYZ",
  "name": "run-adapter",
  "status": "completed",
  "startedAt": "2026-05-17T15:35:00Z",
  "endedAt": "2026-05-17T15:48:00Z",
  "retryCount": 0
}
```

### 9.5 Log

Logs are attached to runs and optionally to steps.

```json
{
  "id": "log_01HXYZ",
  "runId": "run_01HXYZ",
  "stepId": "step_01HXYZ",
  "stream": "stdout",
  "message": "Running aider...",
  "timestamp": "2026-05-17T15:36:00Z"
}
```

### 9.6 Artifact

Artifacts are generated outputs from a run.

Examples:

- diff patch
- test output
- generated file
- markdown summary
- command transcript
- PR URL, in future

```json
{
  "id": "artifact_01HXYZ",
  "runId": "run_01HXYZ",
  "type": "diff",
  "path": "/artifacts/run_01HXYZ/changes.diff",
  "createdAt": "2026-05-17T15:49:00Z"
}
```

---

## 10. Task Lifecycle

### 10.1 Basic Lifecycle

```text
submitted
  -> queued
  -> assigned
  -> running
  -> succeeded
```

Failure path:

```text
submitted
  -> queued
  -> assigned
  -> running
  -> failed
  -> retrying
  -> queued
```

Cancellation path:

```text
submitted
  -> queued
  -> cancelled
```

or:

```text
running
  -> cancelling
  -> cancelled
```

### 10.2 Status Values

Recommended task statuses:

```text
submitted
queued
assigned
running
waiting_for_approval
succeeded
failed
retrying
cancelled
timed_out
```

For 0.1.0, required statuses:

```text
queued
assigned
running
succeeded
failed
cancelled
```

---

## 11. Node Model

### 11.1 Node Registration

A node starts with:

```bash
workplane node start \
  --name "Mac Mini Office" \
  --capabilities shell,git,node,typescript,aider
```

The node registers with the control plane.

### 11.2 Node Capabilities

Capabilities are simple string labels.

Examples:

```text
shell
git
docker
node
typescript
python
aider
claude-code
openhands
ollama
vllm
cuda
macos
linux
github
```

Tasks declare required capabilities.

```json
{
  "adapter": "aider",
  "requires": ["git", "aider"]
}
```

The scheduler assigns the task to a node that satisfies all required capabilities.

### 11.3 Node Heartbeat

Nodes should periodically update:

```text
lastHeartbeatAt
status
currentRunId
resourceSnapshot
```

For 0.1.0, heartbeat can be basic.

### 11.4 Node Assignment Model

There are two possible models.

#### Option A: Polling

Nodes poll the control plane for available work.

Pros:

- simple
- no inbound node networking
- works well over Tailscale/WireGuard
- easier firewall model
- good fit for home/office machines

Cons:

- slight polling delay
- requires polling interval

#### Option B: Push

The control plane pushes tasks to nodes.

Pros:

- immediate assignment
- more direct scheduling

Cons:

- requires reachable nodes
- more networking complexity
- harder with firewalls/NAT

### 11.5 Recommendation for 0.1.0

Use **node polling**.

```text
node -> control plane: any tasks for my capabilities?
control plane -> node: task assignment
node -> control plane: status/log updates
```

---

## 12. Adapter Model

### 12.1 Adapter Categories

Workplane should support broad adapter categories over time.

Initial category:

```text
agent adapters
```

But the core should support any adapter type.

Possible adapter categories:

```text
shell.exec
git.operation
agent.run
test.run
build.run
inference.batch
deploy.operation
```

### 12.2 Initial Adapters

0.1.0 should include:

1. `shell`
2. `aider`

The Git functionality should initially be implemented as a shared workspace helper rather than a full adapter.

### 12.3 Future Agent Adapters

Future agent adapters:

- `claude-code`
- `openhands`
- `custom-agent`

These should all conform to the same adapter interface.

### 12.4 Future Inference Adapters

Future inference adapters:

- `ollama`
- `vllm`
- `exo`

These should support jobs such as:

- local model invocation
- batch evaluation
- summarization
- embeddings
- regression testing
- agent model selection

---

## 13. Adapter Interface

### 13.1 Common Adapter Contract

Each adapter should implement a common TypeScript interface.

```ts
export interface WorkContext {
  taskId: string;
  runId: string;
  nodeId: string;
  workspacePath: string;
  env: Record<string, string>;

  log(message: string): Promise<void>;

  exec(
    command: string,
    args?: string[],
    options?: ExecOptions
  ): Promise<ExecResult>;

  emitArtifact(artifact: ArtifactInput): Promise<void>;

  getWorkspacePath(...segments: string[]): string;
}

export interface WorkAdapter<TInput = unknown, TResult = unknown> {
  name: string;
  kind: string;
  requiredCapabilities?: string[];

  prepare?(ctx: WorkContext, input: TInput): Promise<void>;

  run(ctx: WorkContext, input: TInput): Promise<TResult>;

  cleanup?(
    ctx: WorkContext,
    input: TInput,
    result?: TResult
  ): Promise<void>;
}

export interface ExecResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface ArtifactInput {
  type: string;
  name: string;
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface RunInputEvent {
  id: string;
  runId: string;
  sequence: number;
  kind: "stdin" | "signal" | "resize";
  payload: Record<string, unknown>;
  createdAt: string;
  deliveredAt?: string;
}
```

### 13.2 Shell Adapter

The shell adapter executes a configured command.

Example task:

```json
{
  "kind": "shell.exec",
  "adapter": "shell",
  "command": "npm test",
  "repo": "git@github.com:org/project.git"
}
```

Required behavior:

- create workspace
- clone repo if provided
- run command
- capture stdout/stderr
- return exit code
- mark task failed if exit code is non-zero

Example implementation sketch:

```ts
export const shellAdapter: WorkAdapter<ShellInput, ShellResult> = {
  name: "shell",
  kind: "shell.exec",
  requiredCapabilities: ["shell"],

  async run(ctx, input) {
    const result = await ctx.exec(input.command, input.args ?? []);

    return {
      status: result.exitCode === 0 ? "succeeded" : "failed",
      exitCode: result.exitCode
    };
  }
};
```

### 13.3 Aider Adapter

The Aider adapter executes Aider in a workspace.

Example task:

```json
{
  "kind": "agent.run",
  "adapter": "aider",
  "repo": "git@github.com:org/project.git",
  "prompt": "Fix the failing tests in the billing module.",
  "model": "openai/gpt-4.1"
}
```

Required behavior:

- create workspace
- clone repo
- create task branch
- run Aider with prompt
- capture logs
- capture diff artifact
- optionally run test command
- return status

Example implementation sketch:

```ts
export const aiderAdapter: WorkAdapter<AiderInput, AiderResult> = {
  name: "aider",
  kind: "agent.run",
  requiredCapabilities: ["git", "aider"],

  async run(ctx, input) {
    await ctx.exec("aider", [
      "--model",
      input.model,
      "--message",
      input.prompt
    ]);

    await ctx.exec("git", ["diff", "--output", "changes.diff"]);

    await ctx.emitArtifact({
      type: "diff",
      name: "changes.diff",
      path: ctx.getWorkspacePath("repo", "changes.diff")
    });

    return {
      status: "succeeded"
    };
  }
};
```

### 13.4 Future Claude Code Adapter

The future Claude Code adapter should support:

```json
{
  "kind": "agent.run",
  "adapter": "claude-code",
  "repo": "git@github.com:org/project.git",
  "prompt": "Refactor the auth middleware."
}
```

The Workplane control plane must not depend on Claude-specific concepts.

The Claude Code adapter will likely require interactive terminal support because long-running agent CLIs may need follow-up input while the process is still active.

### 13.5 Future OpenHands Adapter

The future OpenHands adapter should support longer-running software-agent workflows and richer sandboxing.

It should still conform to the common adapter interface.

### 13.6 Long-Running Interactive Adapter Contract

Some adapters run interactive terminal programs rather than one-shot commands.

Examples:

- `claude`
- `claude-code`
- `openhands`
- long-running shell commands that ask for input

For these adapters, Workplane should preserve the private-node polling model. Clients should not connect directly to nodes. Instead, the control plane mediates input and output.

Recommended flow:

```text
client -> control plane: POST /runs/:runId/input
control plane -> Postgres: persist input event
node -> control plane: poll pending input events for active run
node -> process stdin or PTY: write input
node -> control plane: append stdout/stderr logs
client -> control plane: read logs
```

Interactive adapters should declare:

```ts
export interface WorkAdapter<TInput = unknown, TResult = unknown> {
  name: string;
  kind: string;
  requiredCapabilities?: string[];
  interactive?: boolean;
  terminalMode?: "stdio" | "pty";

  run(ctx: WorkContext, input: TInput): Promise<TResult>;
}
```

`stdio` mode is sufficient for simple line-oriented processes.

`pty` mode is required for terminal-native CLIs that need TTY behavior, cursor control, prompt rendering, or terminal resize events.

Minimum interactive control-plane API:

```http
POST /runs/:runId/input
GET /runs/:runId/input?afterSequence=123
POST /runs/:runId/input/:eventId/delivered
```

Initial input event kinds:

| Kind | Meaning |
|---|---|
| `stdin` | Write text or bytes to the process |
| `signal` | Send process signal such as `SIGTERM` |
| `resize` | Resize PTY dimensions |

Suggested table:

```sql
create table run_input_events (
  id text primary key,
  run_id text not null references runs(id),
  sequence bigint not null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz null
);
```

Cancellation for long-running adapters should use escalation:

```text
cancel requested
  -> send SIGTERM
  -> wait grace period
  -> send SIGKILL
  -> mark run cancelled
```

Interactive input should only be accepted for:

- runs in `running` state
- adapters that declare `interactive: true`
- authenticated clients authorized to control the run

For 0.1.0 local-first work, a minimal implementation may support `stdin` input for a running shell task. PTY support can follow when implementing `claude-code`.

---

## 14. Workspace Model

### 14.1 Workspace Root

Each node should have a configured workspace root.

```bash
WORKPLANE_WORKSPACE_ROOT=/var/lib/workplane/workspaces
```

Each run gets a unique workspace:

```text
/var/lib/workplane/workspaces/run_01HXYZ/
```

### 14.2 Workspace Structure

```text
run_01HXYZ/
  repo/
  logs/
  artifacts/
  tmp/
  metadata.json
```

### 14.3 Workspace Guarantees

For 0.1.0:

- every run gets a separate workspace
- workspaces are not shared between runs
- adapters only operate inside the workspace by default
- repo checkout lives under `workspace/repo`
- artifacts live under `workspace/artifacts`
- logs live under `workspace/logs`

### 14.4 Cleanup

For 0.1.0, cleanup can be manual or time-based.

Future options:

```text
retain all failed runs
retain successful runs for N days
retain artifacts but remove repo checkout
archive logs
```

---

## 15. Git Integration

### 15.1 Required for 0.1.0

0.1.0 should support:

- clone repository
- checkout branch
- create task branch
- capture diff

### 15.2 Optional for 0.1.0

If feasible:

- commit changes
- push branch
- create pull request

### 15.3 Recommendation

For 0.1.0:

```text
Do not require PR creation.
Capture diff artifacts first.
```

PR creation can be optional or moved to 0.2.0.

### 15.4 Future

Future versions should support:

- GitHub issue integration
- GitHub App authentication
- GitLab support
- Bitbucket support
- signed commits
- branch protection awareness
- PR approval gates

---

## 16. CLI Specification

### 16.1 Initialize Project

```bash
workplane init
```

Creates config:

```text
workplane.config.ts
```

### 16.2 Start Control Plane

```bash
workplane server start
```

Starts API/control process.

### 16.3 Start Node

```bash
workplane node start \
  --name "Mac Mini Office" \
  --capabilities shell,git,node,typescript,aider
```

### 16.4 Submit Shell Task

```bash
workplane task submit shell \
  --repo git@github.com:org/project.git \
  --command "npm test"
```

Alternative shorthand:

```bash
workplane run shell \
  --repo git@github.com:org/project.git \
  --command "npm test"
```

### 16.5 Submit Aider Task

```bash
workplane task submit aider \
  --repo git@github.com:org/project.git \
  --prompt "Fix the failing tests in the billing module" \
  --model openai/gpt-4.1
```

Alternative shorthand:

```bash
workplane run aider \
  --repo git@github.com:org/project.git \
  --prompt "Fix the failing tests in the billing module"
```

### 16.6 List Tasks

```bash
workplane tasks
```

### 16.7 Show Task

```bash
workplane task show task_01HXYZ
```

### 16.8 List Runs

```bash
workplane runs
```

### 16.9 Show Run

```bash
workplane run show run_01HXYZ
```

### 16.10 Show Logs

```bash
workplane logs run_01HXYZ
```

or:

```bash
workplane task logs task_01HXYZ
```

### 16.11 Retry Task

```bash
workplane task retry task_01HXYZ
```

### 16.12 Cancel Task

```bash
workplane task cancel task_01HXYZ
```

---

## 17. API Specification

The 0.1.0 API can be REST-based.

### 17.1 Create Task

```http
POST /tasks
```

Example:

```json
{
  "kind": "agent.run",
  "adapter": "aider",
  "repo": "git@github.com:org/project.git",
  "prompt": "Fix failing tests in billing module",
  "model": "openai/gpt-4.1",
  "requires": ["git", "aider", "node"]
}
```

Response:

```json
{
  "taskId": "task_01HXYZ",
  "status": "queued"
}
```

### 17.2 Get Task

```http
GET /tasks/:taskId
```

### 17.3 List Tasks

```http
GET /tasks
```

### 17.4 Cancel Task

```http
POST /tasks/:taskId/cancel
```

### 17.5 Retry Task

```http
POST /tasks/:taskId/retry
```

### 17.6 Get Runs for Task

```http
GET /tasks/:taskId/runs
```

### 17.7 Get Run

```http
GET /runs/:runId
```

### 17.8 Get Logs

```http
GET /runs/:runId/logs
```

### 17.9 Register Node

```http
POST /nodes/register
```

Request:

```json
{
  "name": "Mac Mini Office",
  "hostname": "mac-mini-office",
  "capabilities": ["shell", "git", "node", "typescript", "aider"]
}
```

Response:

```json
{
  "nodeId": "node_mac_mini_01",
  "status": "registered"
}
```

### 17.10 Node Poll

```http
POST /nodes/:nodeId/poll
```

Request:

```json
{
  "capabilities": ["shell", "git", "node", "aider"],
  "currentRunId": null
}
```

Response:

```json
{
  "task": {
    "id": "task_01HXYZ",
    "kind": "agent.run",
    "adapter": "aider",
    "repo": "git@github.com:org/project.git",
    "prompt": "Fix failing tests"
  }
}
```

If no work is available:

```json
{
  "task": null
}
```

### 17.11 Node Status Update

```http
POST /nodes/:nodeId/status
```

### 17.12 Run Status Update

```http
POST /runs/:runId/status
```

### 17.13 Append Logs

```http
POST /runs/:runId/logs
```

---

## 18. Security Model

### 18.1 Trust Boundary

0.1.0 assumes a trusted private network.

Recommended deployment:

```text
Control plane and nodes communicate over Tailscale, Headscale, WireGuard, or private LAN.
```

The control plane should not be exposed directly to the public internet.

### 18.2 Node Authentication

For 0.1.0, use static node tokens.

```bash
WORKPLANE_NODE_TOKEN=...
```

Future versions should support:

- mTLS
- OIDC
- Tailscale identity
- short-lived node credentials
- signed node registration

### 18.3 Task Secrets

Secrets should not be stored directly in task definitions.

0.1.0 may support explicit environment-variable allowlists:

```json
{
  "envAllowlist": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GITHUB_TOKEN"]
}
```

Future versions should integrate with:

- 1Password CLI
- Doppler
- Vault
- AWS Secrets Manager
- GCP Secret Manager
- SOPS

### 18.4 Filesystem Isolation

0.1.0 minimum:

- unique workspace per run
- no default home-directory mounting
- explicit repo checkout
- workspace cleanup controls

Preferred:

- Docker-based execution
- read-only mounts where possible
- no access to host filesystem outside workspace

### 18.5 Network Controls

0.1.0 may not enforce egress limits.

Future versions should support:

- network allowlists
- no-network mode
- GitHub-only mode
- package-registry-only mode
- model-provider-only mode

---

## 19. Configuration

### 19.1 Example Config

```ts
import { defineConfig } from "@workplane/core";

export default defineConfig({
  server: {
    port: 8787
  },

  database: {
    url: process.env.DATABASE_URL
  },

  workspace: {
    root: process.env.WORKPLANE_WORKSPACE_ROOT ?? ".workplane/workspaces",
    retainSuccessfulRunsForDays: 7,
    retainFailedRunsForDays: 30
  },

  adapters: {
    shell: {
      enabled: true
    },

    aider: {
      enabled: true,
      binary: "aider",
      defaultModel: "openai/gpt-4.1"
    }
  },

  security: {
    nodeToken: process.env.WORKPLANE_NODE_TOKEN,
    envAllowlist: [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "GITHUB_TOKEN"
    ]
  }
});
```

---

## 20. Package Structure

Possible monorepo layout:

```text
workplane/
  packages/
    core/
    cli/
    server/
    node/
    adapter-sdk/
    adapter-shell/
    adapter-aider/
    db/
    types/
  examples/
    basic-shell/
    aider-github-task/
  docs/
    getting-started.md
    architecture.md
    adapters.md
    security.md
  docker/
    docker-compose.yml
```

### 20.1 Packages

#### `@workplane/core`

Shared durable task, run, node, routing, workflow, and configuration abstractions.

#### `@workplane/server`

Control plane API.

#### `@workplane/node`

Node runtime process.

#### `@workplane/cli`

Command-line interface.

#### `@workplane/adapter-sdk`

Common adapter interface and context helpers.

#### `@workplane/adapter-shell`

Shell command adapter.

#### `@workplane/adapter-aider`

Aider agent adapter.

#### `@workplane/db`

Database schema and migrations.

#### `@workplane/types`

Shared TypeScript types.

---

## 21. DBOS Workflow Sketch

Illustrative only:

```ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import {
  assignNode,
  createRun,
  updateTaskStatus,
  markRunCompleted,
  markRunFailed
} from "./task-store";

export class WorkplaneWorkflow {
  @DBOS.workflow()
  static async runTask(taskId: string) {
    await updateTaskStatus(taskId, "queued");

    const node = await DBOS.step(() => assignNode(taskId), {
      name: "assign-node",
      retriesAllowed: true
    });

    const run = await DBOS.step(() => createRun(taskId, node.id), {
      name: "create-run"
    });

    await updateTaskStatus(taskId, "assigned");

    /*
      In 0.1.0, actual execution is performed by a polling node.
      DBOS owns durable workflow state.
      Nodes own command execution.
    */

    return {
      taskId,
      runId: run.id,
      nodeId: node.id,
      status: "assigned"
    };
  }

  @DBOS.workflow()
  static async completeRun(runId: string, result: unknown) {
    await markRunCompleted(runId, result);
  }

  @DBOS.workflow()
  static async failRun(runId: string, error: unknown) {
    await markRunFailed(runId, error);
  }
}
```

This sketch may need adjustment to align with actual DBOS TypeScript APIs.

---

## 22. Key Architecture Decision

### 22.1 DBOS Execution Boundary

Question:

> Should DBOS workflows directly execute task steps, or should DBOS orchestrate assignment while nodes execute independently?

Recommendation:

```text
DBOS owns durable workflow state.
Nodes own actual adapter execution.
```

Reasoning:

- Keeps command execution close to the selected machine
- Avoids requiring DBOS workflow code to run arbitrary external tools directly
- Supports node-specific capabilities
- Supports private machines behind NAT/firewalls
- Keeps adapter execution isolated inside the node runtime

---

## 23. 0.1.0 User Stories

### 23.1 Run a Shell Task

As a developer, I want to submit a shell command against a repository so that I can run tests on a capable node.

```bash
workplane task submit shell \
  --repo git@github.com:org/project.git \
  --command "npm test"
```

Acceptance criteria:

- task is created
- node picks up task
- repo is cloned
- command runs
- logs are captured
- status is marked succeeded or failed

### 23.2 Run an Aider Task

As a developer, I want to ask Aider to modify a repo so an AI coding task can run on a selected node.

```bash
workplane task submit aider \
  --repo git@github.com:org/project.git \
  --prompt "Fix failing tests in billing module"
```

Acceptance criteria:

- task is created
- node with `aider` capability is selected
- repo is cloned
- Aider runs with the prompt
- logs are captured
- diff artifact is created
- status is marked succeeded or failed

### 23.3 Inspect Logs

As a developer, I want to inspect logs from a run so I can understand what happened.

```bash
workplane logs run_01HXYZ
```

Acceptance criteria:

- logs are displayed in chronological order
- stdout and stderr are identifiable
- failed runs show error output

### 23.4 Retry a Failed Task

As a developer, I want to retry a failed task so transient errors do not require recreating the task.

```bash
workplane task retry task_01HXYZ
```

Acceptance criteria:

- new run is created
- attempt count increments
- original logs remain available
- new logs are captured separately

### 23.5 Route Based on Capabilities

As a developer, I want Workplane to send work to the right node based on capabilities.

Example:

```json
{
  "adapter": "aider",
  "requires": ["git", "aider", "node"]
}
```

Acceptance criteria:

- task is only assigned to nodes with all required capabilities
- unavailable nodes are ignored
- failed assignment leaves task queued or failed with a useful reason

---

## 24. Future Roadmap

### 24.1 Version 0.2.0

Possible scope:

- Claude Code adapter
- OpenHands adapter
- human approval checkpoints
- GitHub PR creation
- Docker isolation
- task cancellation
- node offline detection
- basic web dashboard
- richer artifact viewer

### 24.2 Version 0.3.0

Possible scope:

- local inference adapter abstraction
- Ollama adapter
- vLLM adapter
- exo adapter
- resource-aware scheduling
- node load reporting
- artifact browser
- policy configuration
- cost and token tracking

### 24.3 Version 0.4.0+

Possible scope:

- multi-user support
- RBAC
- GitHub App integration
- secrets manager integrations
- mTLS node authentication
- Tailscale identity integration
- webhook triggers
- scheduled tasks
- agent evaluation framework
- prompt/version audit trail
- plugin marketplace

---

## 25. Open Questions

### 25.1 Docker Required or Optional?

Should 0.1.0 require Docker?

Initial recommendation:

```text
Docker optional for 0.1.0.
Filesystem workspace isolation required.
Docker isolation preferred in 0.2.0.
```

### 25.2 Shell First or Aider First?

Which adapter should be implemented first?

Initial recommendation:

```text
Build shell adapter first.
Then build Aider adapter.
```

### 25.3 GitHub PR Creation in 0.1.0?

Should the first version create PRs?

Initial recommendation:

```text
No. Capture diff artifact first.
PR creation can be optional or moved to 0.2.0.
```

### 25.4 SQLite Local Mode

Should SQLite be supported in 0.1.0?

Initial recommendation:

```text
No. Use Postgres for 0.1.0.
Consider SQLite later for local-only development mode or node cache.
```

### 25.5 Adapter Package Boundary

Should adapters live in separate packages immediately?

Initial recommendation:

```text
Yes, but keep them in the monorepo.
Use separate packages for adapter-shell and adapter-aider.
```

### 25.6 Workflows vs Tasks

Should Workplane expose generic workflows or only tasks?

Initial recommendation:

```text
Expose tasks in 0.1.0.
Do not expose arbitrary workflow authoring yet.
```

---

## 26. Success Criteria for 0.1.0

The MVP is successful if a user can:

1. Install Workplane locally
2. Start Postgres
3. Start the Workplane control plane
4. Start at least one node
5. Register node capabilities
6. Submit a shell task
7. Submit an Aider task
8. See task and run status
9. View logs
10. Inspect generated artifacts
11. Retry a failed task

A compelling 0.1.0 demo:

```text
User submits:
"Fix the failing tests in this repo."

Workplane:
- creates a durable task
- routes it to a capable node
- creates a clean workspace
- clones the repo
- runs Aider
- captures logs
- generates a diff artifact
- optionally runs tests
- reports success or failure
```

---

## 27. Recommended 0.1.0 Build Order

### Phase 1: Foundation

- create monorepo
- add TypeScript packages
- add config system
- add Postgres connection
- add DBOS setup
- define task/node/run/log/artifact schema

### Phase 2: Control Plane

- implement task creation
- implement task listing
- implement task retrieval
- implement node registration
- implement node heartbeat
- implement node polling
- implement basic capability matching

### Phase 3: Node Runtime

- implement node process
- implement workspace creation
- implement repo checkout helper
- implement shell adapter execution
- capture stdout/stderr
- persist logs
- update run status

### Phase 4: CLI

- `workplane init`
- `workplane server start`
- `workplane node start`
- `workplane task submit shell`
- `workplane tasks`
- `workplane runs`
- `workplane logs`

### Phase 5: Aider Adapter

- add adapter SDK
- add Aider adapter package
- add prompt handling
- add diff artifact generation
- add optional test command
- add example Aider task

### Phase 6: Retry and Artifacts

- add retry command
- preserve run history
- improve artifact capture
- add better error reporting
- add basic cleanup policy

### Phase 7: Documentation

- README
- getting started
- architecture
- adapter authoring guide
- security model
- example workflows

---

## 28. First Public README Shape

```markdown
# Workplane

Workplane is a TypeScript-first durable execution plane for routing work across trusted nodes.

It lets you run shell tasks, AI coding agents, and automation jobs across your own machines with durable state, logs, retries, and artifacts.

## Example

```bash
workplane task submit aider \
  --repo git@github.com:your-org/your-app.git \
  --prompt "Fix the failing tests in the billing module"
```

Workplane will:

- create a durable task
- route it to a capable node
- clone the repository into a clean workspace
- run the Aider adapter
- capture logs
- save artifacts
- report final status

## Why Workplane?

AI agents and long-running automation jobs are powerful, but they need a reliable execution plane.

Workplane provides:

- durable execution through DBOS and Postgres
- capability-based node routing
- adapter-based execution
- private-network-friendly node polling
- per-run workspaces
- logs and artifacts
- retryable tasks

## Initial Adapters

- shell
- Aider

## Future Adapters

- Claude Code
- OpenHands
- Ollama
- vLLM
- exo
```

---

## 29. Final 0.1.0 Definition

Workplane 0.1.0 is complete when it can reliably do the following:

> Route a durable task to a capable node and execute it through an adapter.

The first proof points are:

- `shell.exec`
- `agent.run` via Aider

The architectural foundation should support future adapter families without making 0.1.0 overly abstract.

---

## 30. Implementation Philosophy

Workplane should start small.

The core 0.1.0 system should prove these primitives:

1. durable task creation
2. node registration
3. capability matching
4. node polling
5. workspace creation
6. adapter execution
7. log capture
8. artifact capture
9. run status tracking
10. retry

Everything else should be deferred unless it directly supports the first demo.

The goal is not to build a universal distributed platform immediately.

The goal is to build the simplest useful execution plane for routing real work to trusted nodes, with agentic coding tasks as the first compelling use case.
