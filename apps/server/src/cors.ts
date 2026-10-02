import type { IncomingMessage, ServerResponse } from "node:http";

export interface CorsConfig {
  allowAll: boolean;
  origins: Set<string>;
}

/** Parses `WORKPLANE_CORS_ORIGINS` (comma-separated origins, or `*`). Unset or empty means CORS is off. */
export function parseCorsOrigins(value: string | undefined): CorsConfig | null {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    return null;
  }
  return { allowAll: entries.includes("*"), origins: new Set(entries) };
}

/**
 * Adds CORS headers for allowed origins and answers preflight requests.
 * Returns true when the request was fully handled (a preflight).
 */
export function applyCors(req: IncomingMessage, res: ServerResponse, config: CorsConfig | null): boolean {
  if (!config) {
    return false;
  }
  const origin = req.headers.origin;
  const allowed = typeof origin === "string" && (config.allowAll || config.origins.has(origin));
  if (allowed) {
    res.setHeader("access-control-allow-origin", config.allowAll ? "*" : origin);
    res.setHeader("vary", "Origin");
  }
  if (req.method === "OPTIONS" && typeof req.headers["access-control-request-method"] === "string") {
    if (allowed) {
      res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.setHeader("access-control-allow-headers", "authorization,content-type");
      res.setHeader("access-control-max-age", "600");
    }
    res.statusCode = allowed ? 204 : 403;
    res.end();
    return true;
  }
  return false;
}
