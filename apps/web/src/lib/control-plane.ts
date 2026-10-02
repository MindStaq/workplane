import "server-only";
import { WorkplaneApiError, WorkplaneClient } from "@workplane/client";
import { notFound } from "next/navigation";

/**
 * Server-side client for the control plane. Server components call it directly, so the operator
 * token (WORKPLANE_OPERATOR_TOKEN) stays in this process. Browser code uses browser-client.ts and the
 * allow-listed /api/workplane proxy instead.
 */
export function controlPlane(): WorkplaneClient {
  return new WorkplaneClient({
    baseUrl: (process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787").replace(/\/+$/, ""),
    token: process.env.WORKPLANE_OPERATOR_TOKEN,
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
}

/** Turns a 404 from the control plane into the Next.js not-found page; every other error propagates to error.tsx. */
export async function orNotFound<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof WorkplaneApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}

/** Optional lookups (for example the schedule behind a workplan run) degrade to undefined instead of failing the page. */
export async function orUndefined<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof WorkplaneApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}
