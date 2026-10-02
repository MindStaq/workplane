import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestBearer, isAuthorizedBearer } from "@workplane/core";

export type RouteAuth = "public" | "node" | "operator" | "read";

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

  if (auth === "read") {
    // Nodes read /runs/:id and /tasks/:id with their own token, so either token opens a protected read.
    const accepted = [config.operatorToken, config.nodeToken].some((token) => token && bearer === token);
    if (!accepted) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "unauthorized read request" }));
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

export interface RouteAuthOptions {
  /** When true, read (GET) routes that are otherwise public require the operator or node token. */
  protectReads?: boolean;
}

export function routeAuthFor(method: string, pathname: string, options: RouteAuthOptions = {}): RouteAuth {
  const auth = baseRouteAuthFor(method, pathname);
  if (options.protectReads && auth === "public" && method === "GET" && pathname !== "/healthz") {
    return "read";
  }
  return auth;
}

function baseRouteAuthFor(method: string, pathname: string): RouteAuth {
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
  if (method === "GET" && /^\/runs\/[^/]+\/input$/.test(pathname)) {
    return "node";
  }
  if (method === "POST" && /^\/runs\/[^/]+\/input\/\d+\/delivered$/.test(pathname)) {
    return "node";
  }

  if (method === "POST" && /^\/runs\/[^/]+\/input$/.test(pathname)) {
    return "operator";
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

  if (method === "POST" && pathname === "/schedules") {
    return "operator";
  }
  if (method === "PATCH" && /^\/schedules\/[^/]+$/.test(pathname)) {
    return "operator";
  }
  if (method === "DELETE" && /^\/schedules\/[^/]+$/.test(pathname)) {
    return "operator";
  }
  if (method === "POST" && /^\/schedules\/[^/]+\/run$/.test(pathname)) {
    return "operator";
  }
  if (method === "POST" && pathname === "/schedules/tick") {
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
  if (auth === "read") {
    return Boolean(config.operatorToken || config.nodeToken);
  }
  return false;
}
