# Workplane UAT Scenarios

Real-world usage examples for validating a running fleet. Each scenario shows the exact CLI calls, what to watch for, and how to interpret results.

**Prerequisites:**
- Control plane running and reachable (`WORKPLANE_SERVER_URL`)
- At least one node registered with the required capabilities
- Tokens set in your shell or `.env`:
  ```bash
  export WORKPLANE_SERVER_URL=http://100.64.0.1:8787
  export WORKPLANE_OPERATOR_TOKEN=<your-operator-token>
  ```

---

## 1. Shell — remote script execution

**Scenario:** Run a maintenance script from a URL on a remote node. The node has network access; your laptop does not need to reach the target host.

```bash
workplane task submit shell \
  --command "curl -fsSL https://raw.githubusercontent.com/your-org/ops-scripts/main/cleanup-old-logs.sh | bash" \
  --requires shell
```

**What to watch for:**
- Task moves: `queued → assigned → running → succeeded`
- Check logs for script output:
  ```bash
  workplane logs <taskId>
  ```

**Variant — run with a specific environment variable:**

```bash
workplane task submit shell \
  --command "RETENTION_DAYS=30 bash /opt/scripts/rotate-logs.sh" \
  --requires shell
```

---

## 2. Shell — build and test a repository

**Scenario:** Check out a repo on a capable node, run the test suite, and capture the result. Useful when the node has the right runtime versions and credentials that your laptop does not.

```bash
workplane task submit shell \
  --repo git@github.com:your-org/your-api.git \
  --branch main \
  --command "pnpm install --frozen-lockfile && pnpm test" \
  --requires shell,git
```

**What to watch for:**
- The node clones the repo into a timestamped workspace
- `pnpm test` stdout/stderr streams to run logs
- If the command exits non-zero, the run status is `failed`
- Check the test output:
  ```bash
  workplane logs <taskId>
  ```

**Variant — run a deploy script from within the cloned repo:**

```bash
workplane task submit shell \
  --repo git@github.com:your-org/your-api.git \
  --branch release/v2.1 \
  --cwd repo \
  --command "./scripts/deploy-staging.sh" \
  --requires shell,git
```

---

## 3. Claude Code — batch refactor

**Scenario:** One-shot instruction to Claude Code on a private node. The node has the `claude` CLI configured with your API key. No interactive session; Claude runs to completion and the diff is captured as an artifact.

```bash
workplane task submit harness \
  --harness claude-code \
  --repo git@github.com:your-org/your-api.git \
  --branch feature/add-auth \
  --prompt "Refactor the Express middleware in src/middleware/ to use async/await throughout. Remove all callback-style error handlers and replace with try/catch. Do not change the public API signatures." \
  --requires claude-code,git
```

**Monitor until complete:**
```bash
workplane task show <taskId>   # poll manually
workplane logs <taskId>        # read Claude's output
workplane artifacts <taskId>   # inspect the git diff artifact
```

**Variant — with a test gate:** Claude makes the change, then the node runs the test suite. If tests fail the run is marked `failed` and the diff is still captured so you can review it.

```bash
workplane task submit harness \
  --harness claude-code \
  --repo git@github.com:your-org/your-api.git \
  --prompt "Add input validation to all POST endpoints in src/routes/. Use zod. Existing tests must still pass." \
  --test-command "pnpm test" \
  --requires claude-code,git
```

---

## 4. Claude Code — interactive session

**Scenario:** Start a long-running Claude Code session on a PTY. You drive it turn-by-turn through the control plane — no SSH, no direct connection to the node.

**Step 1 — submit the task:**
```bash
workplane task submit harness \
  --harness claude-code \
  --repo git@github.com:your-org/your-api.git \
  --branch feature/user-profiles \
  --prompt "I want to add a user profile feature. Start by exploring the existing user model and auth code, then describe your plan before writing any code." \
  --interactive \
  --requires claude-code,git
```

Note the task ID and wait for it to reach `running`:
```bash
workplane task show <taskId>
```

**Step 2 — resolve the run ID:**
```bash
workplane runs --task-id <taskId>
# note the runId
```

**Step 3 — watch logs in one terminal while you drive in another:**
```bash
# Terminal A — tail logs (re-run as needed to see new output)
workplane logs <runId>

# Terminal B — send follow-up turns
workplane run input <runId> --stdin "Focus on the profile photo upload first. Use S3-compatible storage. Keep the URL in the users table."

# A few minutes later...
workplane run input <runId> --stdin "Good. Now write unit tests for the upload handler."

# When you are done...
workplane run input <runId> --stdin "Commit the changes with a descriptive message and exit."
```

**Step 4 — review:**
```bash
workplane logs <taskId>         # full session transcript
workplane artifacts <taskId>    # git diff of all changes made
```

**If the session gets stuck — send SIGINT to interrupt:**
```bash
workplane run input <runId> --signal SIGINT
```

**If the process is unresponsive — terminate:**
```bash
workplane run input <runId> --signal SIGTERM
# Node escalates to SIGKILL after 5 seconds automatically
```

---

## 5. Codex — batch feature implementation

**Scenario:** Codex in full-auto mode implements a well-scoped feature. Best for tasks with a clear spec where you want hands-off execution.

```bash
workplane task submit harness \
  --harness codex \
  --repo git@github.com:your-org/your-api.git \
  --branch feature/rate-limiting \
  --prompt "Implement per-IP rate limiting on all public API routes. Use a sliding window with a limit of 100 requests per minute. Store counters in Redis. Add a 429 response with a Retry-After header. Include tests." \
  --requires codex,git
```

**Monitor:**
```bash
workplane logs <taskId>       # Codex progress and tool calls
workplane artifacts <taskId>  # git diff of the implementation
```

**Variant — with a test gate:**
```bash
workplane task submit harness \
  --harness codex \
  --repo git@github.com:your-org/your-api.git \
  --prompt "Fix all TypeScript errors reported by tsc --noEmit. Do not change any test files." \
  --test-command "pnpm tsc --noEmit" \
  --requires codex,git
```

---

## 6. Codex — interactive session

**Scenario:** Interactive Codex over stdio — suitable when you want to steer the agent mid-flight, review its proposals before it applies them, or run an exploratory debugging session.

**Step 1 — submit:**
```bash
workplane task submit harness \
  --harness codex \
  --repo git@github.com:your-org/your-api.git \
  --branch bugfix/auth-token-expiry \
  --prompt "There is a bug where JWT tokens are not being rejected after expiry. Start by finding all the places we verify tokens and show me what you find before making any changes." \
  --interactive \
  --requires codex,git
```

**Step 2 — get the run ID:**
```bash
workplane runs --task-id <taskId>
```

**Step 3 — drive the session:**
```bash
# After Codex reports what it found...
workplane run input <runId> --stdin "The issue is in src/auth/verify.ts line 42. The exp check is comparing against Date.now() but the token exp field is in seconds not milliseconds. Fix that specific line."

# After Codex proposes the fix...
workplane run input <runId> --stdin "Apply the fix and also add a test that specifically covers the expiry boundary case."

# When satisfied...
workplane run input <runId> --stdin "Commit and exit."
```

**Step 4 — review result:**
```bash
workplane logs <taskId>
workplane artifacts <taskId>
```

---

## 7. Resize the terminal window (PTY sessions only)

When running Claude Code interactively (PTY mode), you can resize the remote PTY to match your local terminal:

```bash
# Get your current terminal dimensions
echo "${COLUMNS}x${LINES}"

# Send the resize event
workplane run input <runId> --resize 220x50
```

This is useful if Claude's output formatting looks wrapped or truncated.

---

## 8. Operational commands

```bash
# List all running tasks
workplane tasks --status running

# List all runs for a task
workplane runs --task-id <taskId>

# Show run detail (status, adapter, timestamps)
workplane run show <runId>

# Retry a failed task (creates a new run)
workplane task retry <taskId>

# Cancel a running task
workplane task cancel <taskId>

# List artifacts for a run (git diffs, test output)
workplane artifacts <runId>

# Check which nodes are registered and their capabilities
# (use server logs or query DB directly in v0.2.0 — node listing is a v0.3.0 CLI feature)
```

---

## 9. Reading the git diff artifact

Every harness run (batch or interactive) captures a `git diff` after the agent exits. Retrieve it:

```bash
workplane artifacts <runId>
# Output includes artifact paths on the node's workspace

# The diff is stored as a file in the run workspace on the node.
# To read it, SSH to the node and cat the file, or
# check the artifact metadata for the path:
workplane logs <runId>   # look for "captured git diff" log entry
```

---

## 10. Capability requirements quick reference

| Adapter | `--requires` suggestion | Notes |
|---------|------------------------|-------|
| `shell` | `shell` | Any node works |
| `shell` + repo | `shell,git` | Node needs git on PATH |
| `aider` | `git,aider` | Node needs `aider` CLI |
| `claude-code` batch | `claude-code,git` | Node needs `claude` CLI + `ANTHROPIC_API_KEY` |
| `claude-code` interactive | `claude-code,git` | Same; node spawns a PTY |
| `codex` batch | `codex,git` | Node needs `codex` CLI |
| `codex` interactive | `codex,git` | Same; node uses stdio pipe |
| `ollama` | `ollama` | Node needs `ollama` running |
