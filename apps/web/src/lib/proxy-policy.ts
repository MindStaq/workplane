/**
 * Which control-plane routes the browser may reach through the server-side proxy. Anything not
 * listed is refused, so node-only routes (register, poll, status and log ingestion, ...) and any
 * future internal route are unreachable from the browser by default.
 */
const ID = "[A-Za-z0-9_-]+";

const ALLOWED: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^\/healthz$/ },
  { method: "GET", pattern: /^\/tasks$/ },
  { method: "GET", pattern: new RegExp(`^/tasks/${ID}$`) },
  { method: "POST", pattern: /^\/tasks$/ },
  { method: "POST", pattern: new RegExp(`^/tasks/${ID}/(retry|cancel)$`) },
  { method: "GET", pattern: /^\/runs$/ },
  { method: "GET", pattern: new RegExp(`^/runs/${ID}$`) },
  { method: "GET", pattern: new RegExp(`^/runs/${ID}/(logs|artifacts)$`) },
  { method: "GET", pattern: new RegExp(`^/runs/${ID}/input$`) },
  { method: "POST", pattern: new RegExp(`^/runs/${ID}/input$`) },
  { method: "GET", pattern: /^\/(nodes|skills|plans)$/ },
  { method: "GET", pattern: /^\/schedules$/ },
  { method: "POST", pattern: /^\/schedules$/ },
  { method: "POST", pattern: /^\/schedules\/tick$/ },
  { method: "GET", pattern: new RegExp(`^/schedules/${ID}$`) },
  { method: "PATCH", pattern: new RegExp(`^/schedules/${ID}$`) },
  { method: "DELETE", pattern: new RegExp(`^/schedules/${ID}$`) },
  { method: "POST", pattern: new RegExp(`^/schedules/${ID}/run$`) },
  { method: "GET", pattern: /^\/workplan-runs$/ },
  { method: "GET", pattern: new RegExp(`^/workplan-runs/${ID}$`) },
  { method: "GET", pattern: new RegExp(`^/workplan-runs/${ID}/steps$`) },
];

export function isProxyAllowed(method: string, segments: string[]): boolean {
  if (segments.length === 0 || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }
  const path = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  return ALLOWED.some((rule) => rule.method === method.toUpperCase() && rule.pattern.test(path));
}
