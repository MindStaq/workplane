import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestBearer, isAuthorizedBearer } from "../../core/src/auth.js";

export type RouteAuth = "public" | "node" | "operator";

export interface AuthConfig {
  nodeToken?: string;
  operatorToken?: string;
}

export function checkRouteAuth(
  req: IncomingMessage,
  res: ServerResponse,
  auth: RouteAuth,
  config: AuthConfig,
): boolean {
  const bearer = getRequestBearer(req);

  if (auth === "public") {
    return true;
  }

  if (auth === "node") {
    if (!isAuthorizedBearer(bearer, config.nodeToken)) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "unauthorized node request" }));
      return false;
    }
    return true;
  }

  if (auth === "operator") {
    if (!isAuthorizedBearer(bearer, config.operatorToken)) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "unauthorized operator request" }));
      return false;
    }
    return true;
  }

  return true;
}

export function routeAuthFor(method: string, pathname: string): RouteAuth {
  if (pathname === "/healthz") {
    return "public";
  }

  if (method === "POST" && pathname === "/nodes/register") {
    return "node";
  }
  if (method === "POST" && /^\/nodes\/[^/]+\/poll$/.test(pathname)) {
    return "node";
  }
  if (method === "POST" && /^\/runs\/[^/]+\/status$/.test(pathname)) {
    return "node";
  }
  if (method === "POST" && /^\/runs\/[^/]+\/logs$/.test(pathname)) {
    return "node";
  }
  if (method === "POST" && /^\/runs\/[^/]+\/artifacts$/.test(pathname)) {
    return "node";
  }

  if (method === "POST" && pathname === "/tasks") {
    return "operator";
  }
  if (method === "POST" && /^\/tasks\/[^/]+\/retry$/.test(pathname)) {
    return "operator";
  }
  if (method === "POST" && /^\/tasks\/[^/]+\/cancel$/.test(pathname)) {
    return "operator";
  }

  return "public";
}

export function requiresConfiguredToken(auth: RouteAuth, config: AuthConfig): boolean {
  if (auth === "node") {
    return Boolean(config.nodeToken);
  }
  if (auth === "operator") {
    return Boolean(config.operatorToken);
  }
  return false;
}
