import { WorkplaneClient } from "@workplane/client";

let cached: WorkplaneClient | undefined;

/** Client for browser code. It talks to the same-origin proxy, never to the control plane directly. */
export function browserClient(): WorkplaneClient {
  cached ??= new WorkplaneClient({ baseUrl: `${window.location.origin}/api/workplane` });
  return cached;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const detail = /: (\{.*\})$/.exec(error.message);
    if (detail) {
      try {
        const parsed = JSON.parse(detail[1]) as { error?: unknown };
        if (typeof parsed.error === "string") return parsed.error;
      } catch {
        // fall through to the raw message
      }
    }
    return error.message;
  }
  return "Something went wrong.";
}
