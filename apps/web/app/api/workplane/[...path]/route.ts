import { isProxyAllowed } from "../../../../src/lib/proxy-policy";

/**
 * Server-side proxy to the control plane. The operator token lives only in this process
 * (WORKPLANE_OPERATOR_TOKEN) and is never sent to the browser. Only routes listed in
 * proxy-policy.ts are forwarded.
 */
export const dynamic = "force-dynamic";

const serverUrl = (): string => (process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787").replace(/\/+$/, "");

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  if (!isProxyAllowed(request.method, path)) {
    return Response.json({ error: "route not available through the proxy" }, { status: 403 });
  }

  const incoming = new URL(request.url);
  const target = `${serverUrl()}/${path.map(encodeURIComponent).join("/")}${incoming.search}`;
  const token = process.env.WORKPLANE_OPERATOR_TOKEN;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ error: "control plane unreachable" }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
