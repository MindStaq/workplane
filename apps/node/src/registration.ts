export interface RegistrationRetryOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30_000;

export function backoffDelay(attempt: number, initialDelayMs: number, maxDelayMs: number): number {
  return Math.min(maxDelayMs, initialDelayMs * 2 ** Math.max(0, attempt - 1));
}

export function httpStatusOf(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /^(\d{3}) /.exec(message);
  return match ? Number(match[1]) : undefined;
}

/** The server no longer knows this node (restarted on a fresh database, or the token changed). */
export function isNodeUnknownError(error: unknown): boolean {
  const status = httpStatusOf(error);
  return status === 401 || status === 404;
}

/**
 * Registers with the control plane, retrying with exponential backoff until it succeeds.
 * A node may start before the server, or outlive a server restart, so registration never gives up.
 */
export async function registerWithRetry(
  register: () => Promise<string>,
  options: RegistrationRetryOptions = {},
): Promise<string> {
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const log = options.log ?? ((message: string) => process.stderr.write(`${message}\n`));

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await register();
    } catch (error) {
      const delay = backoffDelay(attempt, initialDelayMs, maxDelayMs);
      log(`registration failed (attempt ${attempt}): ${String(error)}; retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
    }
  }
}
