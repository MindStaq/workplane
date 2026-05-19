import type { IncomingMessage } from "node:http";

export function parseBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1];
}

export function isAuthorizedBearer(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected) {
    return true;
  }
  if (!provided) {
    return false;
  }
  return provided === expected;
}

export function getRequestBearer(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  return parseBearerToken(value);
}

export function authHeaders(token: string | undefined): Record<string, string> {
  if (!token) {
    return {};
  }
  return { authorization: `Bearer ${token}` };
}
