import { loadLocalEnv } from "../packages/core/src/env.js";

loadLocalEnv();

interface CreateTaskResponse {
  id: string;
  status: string;
}

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} from ${url}: ${body}`);
  }

  return (await response.json()) as T;
}

async function main(): Promise<void> {
  const serverUrl = process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";
  const command = parseArg("--command") ?? "echo local-submit-test";
  const testCapability = parseArg("--capability") ?? "submit_test_only";

  await fetchJson(`${serverUrl}/healthz`);

  const task = await fetchJson<CreateTaskResponse>(`${serverUrl}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      kind: "shell.exec",
      adapter: "shell",
      requires: [testCapability],
      payload: {
        command,
      },
    }),
  });

  process.stdout.write(`Submitted task to local server\n`);
  process.stdout.write(`taskId=${task.id}\n`);
  process.stdout.write(`status=${task.status}\n`);
  process.stdout.write(`server=${serverUrl}\n`);
  process.stdout.write(`requires=${testCapability}\n`);
}

main().catch((error) => {
  process.stderr.write(`Submit test failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

