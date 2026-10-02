import { authHeaders } from "./auth.js";

export interface WorkplaneHttpOptions {
  method?: string;
  body?: unknown;
  nodeToken?: string;
  operatorToken?: string;
}

export function buildWorkplaneHeaders(options: WorkplaneHttpOptions = {}): Record<string, string> {
  const token = options.nodeToken ?? options.operatorToken;
  return {
    "content-type": "application/json",
    ...authHeaders(token),
  };
}

export async function workplaneFetch<T>(
  serverUrl: string,
  path: string,
  options: WorkplaneHttpOptions = {},
): Promise<T> {
  const response = await fetch(`${serverUrl}${path}`, {
    method: options.method ?? "GET",
    headers: buildWorkplaneHeaders(options),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText} from ${path}: ${text}`);
  }

  return (await response.json()) as T;
}
