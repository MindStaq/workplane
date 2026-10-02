import type {
  ArtifactRecord,
  NodeRecord,
  RunInputEvent,
  RunLogRecord,
  RunRecord,
  SkillEntry,
  TaskRecord,
  WorkplanRunRecord,
  WorkplanScheduleRecord,
  WorkplanStepResultRecord,
} from "./types"

// Single mock data module (plan 10.1): every screen reads through the getters at the bottom,
// so they can be swapped for @workplane/client calls one by one.

// A fixed clock keeps relative times stable between server and client renders.
export const NOW = new Date("2026-10-02T14:32:00Z").getTime()
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()
const ahead = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

export const CONTROL_PLANE = {
  url: "http://homelab-01.tail3c9e.ts.net:7070",
  version: "0.4.5",
  database: "sqlite",
  databasePath: "~/.workplane/workplane.db",
}

export const nodes: NodeRecord[] = [
  {
    id: "node_7f3a91",
    name: "gpu-box",
    capabilities: ["shell", "git", "ollama", "cuda", "gpu:rtx4090"],
    status: "online",
    lastHeartbeatAt: ago(0.1),
    host: "10.8.0.3",
    network: "wireguard",
    platform: "linux x64 · Ubuntu 24.04",
    role: "GPU inference",
    models: ["llama3.2", "llama3", "qwen2.5-coder:32b", "nomic-embed-text"],
  },
  {
    id: "node_2c80d4",
    name: "mbp-sai",
    capabilities: ["shell", "git", "claude-code", "codex", "aider"],
    status: "online",
    lastHeartbeatAt: ago(0.2),
    host: "100.101.4.12",
    network: "tailscale",
    platform: "darwin arm64 · macOS 15",
    role: "Agent harnesses",
  },
  {
    id: "node_b41e07",
    name: "homelab-01",
    capabilities: ["shell", "git", "docker", "ollama"],
    status: "online",
    lastHeartbeatAt: ago(0.4),
    host: "192.168.1.20",
    network: "lan",
    platform: "linux x64 · Debian 12",
    role: "Control plane + batch",
    models: ["llama3.2"],
  },
  {
    id: "node_e9925c",
    name: "pi-edge",
    capabilities: ["shell"],
    status: "offline",
    lastHeartbeatAt: ago(187),
    host: "192.168.1.44",
    network: "lan",
    platform: "linux arm64 · Raspberry Pi OS",
    role: "Edge shell",
  },
]

export const tasks: TaskRecord[] = [
  {
    id: "task_01J9Z4K2",
    kind: "harness",
    adapter: "claude-code",
    payload: {
      harness: "claude-code",
      repo: "git@github.com:MindStaq/workplane.git",
      prompt: "Start exploring the codebase",
      interactive: true,
    },
    requires: ["claude-code", "git"],
    status: "running",
    createdAt: ago(14),
    updatedAt: ago(0.3),
  },
  {
    id: "task_01J9Z3RX",
    kind: "inference",
    adapter: "ollama",
    payload: { model: "qwen2.5-coder:32b", prompt: "Explain the retry semantics in workflows-vanilla.ts" },
    requires: ["ollama", "gpu:rtx4090"],
    status: "running",
    createdAt: ago(3),
    updatedAt: ago(0.5),
  },
  {
    id: "task_01J9Z3MB",
    kind: "shell",
    adapter: "shell",
    payload: { command: "pnpm test:nx", repo: "git@github.com:MindStaq/workplane.git" },
    requires: ["shell", "git"],
    status: "assigned",
    createdAt: ago(1),
    updatedAt: ago(0.6),
  },
  {
    id: "task_01J9Z3F0",
    kind: "harness",
    adapter: "codex",
    payload: {
      harness: "codex",
      repo: "git@github.com:MindStaq/workplane.git",
      prompt: "Add GET /nodes and listNodes on the store interface",
    },
    requires: ["codex", "git"],
    status: "queued",
    createdAt: ago(0.8),
    updatedAt: ago(0.8),
  },
  {
    id: "task_01J9Z2YQ",
    kind: "shell",
    adapter: "shell",
    payload: { command: "nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv" },
    requires: ["shell", "cuda"],
    status: "succeeded",
    createdAt: ago(22),
    updatedAt: ago(21),
  },
  {
    id: "task_01J9Z1A7",
    kind: "harness",
    adapter: "aider",
    payload: {
      harness: "aider",
      repo: "git@github.com:MindStaq/workplane.git",
      prompt: "Declare @workplane/adapter-sdk as a dependency of adapter-claude-code and adapter-codex (K8)",
    },
    requires: ["aider", "git"],
    status: "succeeded",
    createdAt: ago(58),
    updatedAt: ago(49),
  },
  {
    id: "task_01J9Z0T4",
    kind: "shell",
    adapter: "shell",
    payload: { command: "pnpm smoke:install --spec workplane@0.4.4-next.0" },
    requires: ["shell", "git"],
    status: "failed",
    createdAt: ago(96),
    updatedAt: ago(91),
  },
  {
    id: "task_01J9YZ88",
    kind: "inference",
    adapter: "ollama",
    payload: { model: "llama3.2", prompt: "Summarise this changelog for the release notes" },
    requires: ["ollama"],
    status: "succeeded",
    createdAt: ago(134),
    updatedAt: ago(133),
  },
  {
    id: "task_01J9YX02",
    kind: "shell",
    adapter: "shell",
    payload: { command: "docker compose pull && docker compose up -d" },
    requires: ["shell", "docker"],
    status: "cancelled",
    createdAt: ago(210),
    updatedAt: ago(205),
  },
  {
    id: "task_01J9YW5K",
    kind: "shell",
    adapter: "shell",
    payload: { command: "uptime && df -h /" },
    requires: ["shell"],
    status: "succeeded",
    createdAt: ago(260),
    updatedAt: ago(260),
  },
]

export const runs: RunRecord[] = [
  { id: "run_8KQ2T1", taskId: "task_01J9Z4K2", nodeId: "node_2c80d4", attempt: 1, status: "running", startedAt: ago(13.6), endedAt: null, error: null },
  { id: "run_8KQ1ZP", taskId: "task_01J9Z3RX", nodeId: "node_7f3a91", attempt: 1, status: "running", startedAt: ago(2.8), endedAt: null, error: null },
  { id: "run_8KQ1X0", taskId: "task_01J9Z3MB", nodeId: "node_b41e07", attempt: 1, status: "assigned", startedAt: null, endedAt: null, error: null },
  { id: "run_8KPZ44", taskId: "task_01J9Z2YQ", nodeId: "node_7f3a91", attempt: 1, status: "succeeded", startedAt: ago(21.9), endedAt: ago(21.8), error: null },
  { id: "run_8KPW10", taskId: "task_01J9Z1A7", nodeId: "node_2c80d4", attempt: 1, status: "succeeded", startedAt: ago(57.5), endedAt: ago(49.2), error: null },
  { id: "run_8KPS02", taskId: "task_01J9Z0T4", nodeId: "node_e9925c", attempt: 1, status: "failed", startedAt: ago(95.6), endedAt: ago(95.1), error: "Node heartbeat lost during run" },
  { id: "run_8KPS9F", taskId: "task_01J9Z0T4", nodeId: "node_b41e07", attempt: 2, status: "failed", startedAt: ago(94.8), endedAt: ago(91.2), error: "Process exited with code 1: better-sqlite3 prebuilt binary not found for node-v137" },
  { id: "run_8KPM3A", taskId: "task_01J9YZ88", nodeId: "node_b41e07", attempt: 1, status: "succeeded", startedAt: ago(133.9), endedAt: ago(133.1), error: null },
  { id: "run_8KPH71", taskId: "task_01J9YX02", nodeId: "node_b41e07", attempt: 1, status: "cancelled", startedAt: ago(209), endedAt: ago(205), error: "Cancelled by operator" },
  { id: "run_8KPE0C", taskId: "task_01J9YW5K", nodeId: "node_e9925c", attempt: 1, status: "succeeded", startedAt: ago(260), endedAt: ago(259.9), error: null },
]

const log = (id: number, runId: string, minAgo: number, stream: RunLogRecord["stream"], message: string, stepName: string | null = null): RunLogRecord => ({
  id,
  runId,
  stepName,
  stream,
  message,
  timestamp: ago(minAgo),
})

export const runLogs: RunLogRecord[] = [
  log(1, "run_8KQ2T1", 13.6, "system", "run assigned to mbp-sai (attempt 1)"),
  log(2, "run_8KQ2T1", 13.5, "system", "git clone git@github.com:MindStaq/workplane.git → /tmp/workplane/run_8KQ2T1"),
  log(3, "run_8KQ2T1", 13.2, "system", "spawning claude-code in PTY (cols=180 rows=48)"),
  log(4, "run_8KQ2T1", 13.1, "stdout", "╭─ Claude Code ─────────────────────────────────────╮"),
  log(5, "run_8KQ2T1", 13.1, "stdout", "│ cwd: /tmp/workplane/run_8KQ2T1                     │"),
  log(6, "run_8KQ2T1", 13.1, "stdout", "╰───────────────────────────────────────────────────╯"),
  log(7, "run_8KQ2T1", 12.9, "stdout", "> Start exploring the codebase"),
  log(8, "run_8KQ2T1", 12.4, "stdout", "Reading nx.json, package.json, apps/*, libs/* …"),
  log(9, "run_8KQ2T1", 11.8, "stdout", "This is an Nx monorepo with 4 apps (cli, server, node, workplane bundle) and 13 libs."),
  log(10, "run_8KQ2T1", 11.7, "stdout", "The control plane (apps/server) exposes tasks, runs, logs, artifacts and schedules over HTTP;"),
  log(11, "run_8KQ2T1", 11.7, "stdout", "nodes (apps/node) poll for work matching their capabilities and execute through adapters."),
  log(12, "run_8KQ2T1", 6.2, "system", "input #1 delivered (stdin, 27 bytes)"),
  log(13, "run_8KQ2T1", 6.1, "stdout", "> Focus on the auth module"),
  log(14, "run_8KQ2T1", 5.6, "stdout", "apps/server/src/auth-middleware.ts guards write routes with WORKPLANE_OPERATOR_TOKEN."),
  log(15, "run_8KQ2T1", 5.5, "stdout", "Note: GET routes are unauthenticated even when the token is set (known issue K9)."),
  log(16, "run_8KQ2T1", 5.4, "stdout", "Node routes use WORKPLANE_NODE_TOKEN via a separate bearer check."),
  log(17, "run_8KQ2T1", 0.3, "stdout", "Waiting for input…"),

  log(30, "run_8KQ1ZP", 2.8, "system", "run assigned to gpu-box (attempt 1)"),
  log(31, "run_8KQ1ZP", 2.8, "system", "ollama: loading qwen2.5-coder:32b (19.8 GB) on cuda:0"),
  log(32, "run_8KQ1ZP", 2.1, "system", "model ready in 41.2s · 38.4 tok/s"),
  log(33, "run_8KQ1ZP", 2.0, "stdout", "`workflows-vanilla.ts` implements retry as a fresh run on the same task:"),
  log(34, "run_8KQ1ZP", 1.9, "stdout", "1. retryTask() resets the task to `queued` and increments the next run's `attempt`."),
  log(35, "run_8KQ1ZP", 1.7, "stdout", "2. Prior runs are kept for history; logs and artifacts stay attached to their run."),
  log(36, "run_8KQ1ZP", 1.2, "stdout", "3. Capability matching happens again, so the retry may land on a different node…"),

  log(50, "run_8KPS9F", 94.8, "system", "run assigned to homelab-01 (attempt 2)"),
  log(51, "run_8KPS9F", 94.7, "stdout", "$ pnpm smoke:install --spec workplane@0.4.4-next.0"),
  log(52, "run_8KPS9F", 94.1, "stdout", "[smoke] installing workplane@0.4.4-next.0 into /tmp/smoke-prefix"),
  log(53, "run_8KPS9F", 92.3, "stdout", "[smoke] ✓ 1/16 workplane --version"),
  log(54, "run_8KPS9F", 92.2, "stdout", "[smoke] ✓ 2/16 workplane-setup (answers 7 prompts)"),
  log(55, "run_8KPS9F", 91.6, "stderr", "Error: Could not locate the bindings file. Tried:"),
  log(56, "run_8KPS9F", 91.6, "stderr", " → node_modules/better-sqlite3/build/Release/better_sqlite3.node"),
  log(57, "run_8KPS9F", 91.5, "stderr", "[smoke] ✗ 3/16 workplane-server health check failed"),
  log(58, "run_8KPS9F", 91.2, "system", "process exited with code 1"),

  log(70, "run_8KPZ44", 21.9, "system", "run assigned to gpu-box (attempt 1)"),
  log(71, "run_8KPZ44", 21.9, "stdout", "utilization.gpu [%], memory.used [MiB]"),
  log(72, "run_8KPZ44", 21.9, "stdout", "3 %, 1204 MiB"),
  log(73, "run_8KPZ44", 21.8, "system", "process exited with code 0"),
]

export const artifacts: ArtifactRecord[] = [
  { id: "art_01", runId: "run_8KPW10", type: "diff", name: "changes.patch", path: "artifacts/run_8KPW10/changes.patch", metadata: { files: 3, additions: 6, deletions: 0 }, createdAt: ago(49.3) },
  { id: "art_02", runId: "run_8KPW10", type: "transcript", name: "aider.chat.md", path: "artifacts/run_8KPW10/aider.chat.md", metadata: { bytes: 18422 }, createdAt: ago(49.2) },
  { id: "art_03", runId: "run_8KPS9F", type: "log", name: "smoke-install.log", path: "artifacts/run_8KPS9F/smoke-install.log", metadata: { bytes: 6110 }, createdAt: ago(91.2) },
  { id: "art_04", runId: "run_8KPM3A", type: "text", name: "release-notes.md", path: "artifacts/run_8KPM3A/release-notes.md", metadata: { tokens: 412 }, createdAt: ago(133.1) },
  { id: "art_05", runId: "run_8KQ2T1", type: "transcript", name: "session.cast", path: "artifacts/run_8KQ2T1/session.cast", metadata: { live: true }, createdAt: ago(13.2) },
]

export const inputEvents: RunInputEvent[] = [
  { id: 1, runId: "run_8KQ2T1", sequence: 1, kind: "stdin", payload: { data: "Focus on the auth module\n" }, createdAt: ago(6.3), deliveredAt: ago(6.2) },
  { id: 2, runId: "run_8KQ2T1", sequence: 2, kind: "resize", payload: { cols: 220, rows: 50 }, createdAt: ago(4), deliveredAt: ago(4) },
]

export const schedules: WorkplanScheduleRecord[] = [
  {
    id: "sch_nightly_review",
    planId: "code-review",
    name: "Nightly code review",
    cronExpression: "0 2 * * *",
    timezone: "America/Los_Angeles",
    inputs: { repoPath: "~/src/workplane", model: "claude-haiku-4-5-20251001" },
    enabled: true,
    lastRunAt: ago(752),
    nextRunAt: ahead(688),
    createdBy: "operator",
    createdAt: ago(60 * 24 * 9),
    updatedAt: ago(60 * 24 * 2),
  },
  {
    id: "sch_weekly_digest",
    planId: "summarize-file",
    name: "Weekly roadmap digest",
    cronExpression: "0 9 * * 1",
    timezone: "America/Los_Angeles",
    inputs: { file: "~/src/workplane/docs/roadmap.md" },
    enabled: true,
    lastRunAt: ago(60 * 24 * 4 + 120),
    nextRunAt: ahead(60 * 24 * 3 - 30),
    createdBy: "operator",
    createdAt: ago(60 * 24 * 20),
    updatedAt: ago(60 * 24 * 20),
  },
  {
    id: "sch_hello_smoke",
    planId: "hello",
    name: "Scheduler smoke test",
    cronExpression: "*/15 * * * *",
    timezone: "UTC",
    inputs: { name: "workplane" },
    enabled: false,
    lastRunAt: ago(60 * 26),
    nextRunAt: null,
    createdBy: "ci",
    createdAt: ago(60 * 24 * 3),
    updatedAt: ago(60 * 25),
  },
]

export const workplanRuns: WorkplanRunRecord[] = [
  { id: "wpr_5D1A", scheduleId: null, planId: "code-review", planName: "Code Review", status: "running", idempotencyKey: null, createdAt: ago(1.5), endedAt: null, error: null },
  { id: "wpr_5C9E", scheduleId: "sch_nightly_review", planId: "code-review", planName: "Code Review", status: "completed", idempotencyKey: "sch_nightly_review:2026-10-02T09:00Z", createdAt: ago(752), endedAt: ago(749), error: null },
  { id: "wpr_5C77", scheduleId: "sch_nightly_review", planId: "code-review", planName: "Code Review", status: "step_failed", idempotencyKey: "sch_nightly_review:2026-10-01T09:00Z", createdAt: ago(752 + 1440), endedAt: ago(751 + 1440), error: "Step 'summarize' failed: ollama unreachable at gpu-box:11434" },
  { id: "wpr_5B02", scheduleId: "sch_weekly_digest", planId: "summarize-file", planName: "Summarize File", status: "completed", idempotencyKey: "sch_weekly_digest:2026-09-28T16:00Z", createdAt: ago(60 * 24 * 4 + 120), endedAt: ago(60 * 24 * 4 + 119), error: null },
  { id: "wpr_5A44", scheduleId: "sch_hello_smoke", planId: "hello", planName: "Hello", status: "completed", idempotencyKey: "sch_hello_smoke:2026-10-01T12:30Z", createdAt: ago(60 * 26), endedAt: ago(60 * 26), error: null },
  { id: "wpr_59F0", scheduleId: null, planId: "summarize-file", planName: "Summarize File", status: "cancelled", idempotencyKey: null, createdAt: ago(60 * 30), endedAt: ago(60 * 30 - 1), error: "Cancelled by operator" },
]

export const workplanSteps: WorkplanStepResultRecord[] = [
  { id: "wps_1", workplanRunId: "wpr_5D1A", stepId: "diff", stepName: "Git Diff", output: "diff --git a/apps/server/src/index.ts b/apps/server/src/index.ts\n+  if (url.pathname === \"/nodes\" && req.method === \"GET\") {\n+    return json(res, 200, { nodes: await store.listNodes() });\n+  }", exitCode: 0, durationMs: 214, metadata: { provider: "shell", node: "homelab-01" }, createdAt: ago(1.4) },
  { id: "wps_2", workplanRunId: "wpr_5D1A", stepId: "summarize", stepName: "Summarize", output: "Adds a GET /nodes route that returns all registered nodes from the store.", exitCode: 0, durationMs: 3920, metadata: { provider: "ollama", model: "llama3", node: "gpu-box", tokens: 61 }, createdAt: ago(1.3) },

  { id: "wps_3", workplanRunId: "wpr_5C9E", stepId: "diff", stepName: "Git Diff", output: "12 files changed, 418 insertions(+), 96 deletions(-)", exitCode: 0, durationMs: 188, metadata: { provider: "shell" }, createdAt: ago(752) },
  { id: "wps_4", workplanRunId: "wpr_5C9E", stepId: "summarize", stepName: "Summarize", output: "Moves packages/* to apps/ and libs/, adds Nx project.json files, and wires pack:check into CI.", exitCode: 0, durationMs: 5410, metadata: { provider: "ollama", model: "llama3", tokens: 94 }, createdAt: ago(751) },
  { id: "wps_5", workplanRunId: "wpr_5C9E", stepId: "critique", stepName: "Critique", output: "Restructure looks safe. Two notes: (1) adapter-claude-code imports adapter-sdk without declaring it; (2) read endpoints remain unauthenticated — fine on localhost, risky on a tailnet.", exitCode: 0, durationMs: 8120, metadata: { provider: "anthropic", model: "claude-haiku-4-5-20251001", inputTokens: 1840, outputTokens: 212 }, createdAt: ago(749) },

  { id: "wps_6", workplanRunId: "wpr_5C77", stepId: "diff", stepName: "Git Diff", output: "3 files changed, 41 insertions(+), 7 deletions(-)", exitCode: 0, durationMs: 172, metadata: { provider: "shell" }, createdAt: ago(752 + 1440) },
  { id: "wps_7", workplanRunId: "wpr_5C77", stepId: "summarize", stepName: "Summarize", output: "connect ECONNREFUSED 10.8.0.3:11434", exitCode: 1, durationMs: 30012, metadata: { provider: "ollama", model: "llama3" }, createdAt: ago(751 + 1440) },

  { id: "wps_8", workplanRunId: "wpr_5B02", stepId: "read", stepName: "Read File", output: "docs/roadmap.md (6.2 KB)", exitCode: 0, durationMs: 4, metadata: { provider: "file" }, createdAt: ago(60 * 24 * 4 + 120) },
  { id: "wps_9", workplanRunId: "wpr_5B02", stepId: "summarize", stepName: "Summarize", output: "Shipped: v0.1–v0.4.3 (tasks, runs, interactive harnesses, workplans, scheduler). Next: Nx layout, typed client, operator web console.", exitCode: 0, durationMs: 2210, metadata: { provider: "anthropic", model: "claude-haiku-4-5-20251001" }, createdAt: ago(60 * 24 * 4 + 119) },

  { id: "wps_10", workplanRunId: "wpr_5A44", stepId: "greet", stepName: "Greet", output: "hello, workplane", exitCode: 0, durationMs: 11, metadata: { provider: "shell" }, createdAt: ago(60 * 26) },

  { id: "wps_11", workplanRunId: "wpr_59F0", stepId: "read", stepName: "Read File", output: "README.md (5.1 KB)", exitCode: 0, durationMs: 3, metadata: { provider: "file" }, createdAt: ago(60 * 30) },
]

export const skills: SkillEntry[] = [
  {
    id: "code-review",
    name: "Code Review",
    description: "Diff a repo, summarise locally with Ollama, then critique with a frontier model.",
    inputs: [
      { name: "repo", type: "path", required: false, description: "Path to the git repository", default: "." },
      { name: "branch", type: "string", required: false, description: "Diff against this branch instead of HEAD~1" },
      { name: "model", type: "model", required: false, description: "Model for the critique step", default: "claude-haiku-4-5-20251001" },
    ],
    steps: [
      { id: "diff", name: "Git Diff", provider: "shell" },
      { id: "summarize", name: "Summarize", provider: "ollama", model: "llama3" },
      { id: "critique", name: "Critique", provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    ],
  },
  {
    id: "summarize-file",
    name: "Summarize File",
    description: "Read a file and produce a concise summary.",
    inputs: [
      { name: "file", type: "path", required: true, description: "File to summarise" },
      { name: "model", type: "model", required: false, description: "Model for the summary", default: "claude-haiku-4-5-20251001" },
    ],
    steps: [
      { id: "read", name: "Read File", provider: "file" },
      { id: "summarize", name: "Summarize", provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    ],
  },
  {
    id: "hello",
    name: "Hello",
    description: "A one-step shell skill used for scheduler smoke tests.",
    inputs: [{ name: "name", type: "string", required: false, description: "Who to greet", default: "world" }],
    steps: [{ id: "greet", name: "Greet", provider: "shell" }],
  },
]

export const getTask = (id: string) => tasks.find((t) => t.id === id)
export const getRun = (id: string) => runs.find((r) => r.id === id)
export const getNode = (id: string) => nodes.find((n) => n.id === id)
export const getRunsForTask = (taskId: string) => runs.filter((r) => r.taskId === taskId).sort((a, b) => b.attempt - a.attempt)
export const getLatestRun = (taskId: string) => getRunsForTask(taskId)[0]
export const getRunsForNode = (nodeId: string) => runs.filter((r) => r.nodeId === nodeId)
export const getLogsForRun = (runId: string) => runLogs.filter((l) => l.runId === runId).sort((a, b) => a.id - b.id)
export const getArtifactsForRun = (runId: string) => artifacts.filter((a) => a.runId === runId)
export const getInputEventsForRun = (runId: string) => inputEvents.filter((e) => e.runId === runId)
export const getWorkplanRun = (id: string) => workplanRuns.find((w) => w.id === id)
export const getStepsForWorkplanRun = (id: string) => workplanSteps.filter((s) => s.workplanRunId === id)
export const getSchedule = (id: string) => schedules.find((s) => s.id === id)
export const getSkill = (id: string) => skills.find((s) => s.id === id)
