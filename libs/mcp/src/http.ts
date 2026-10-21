import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createWorkplaneMcpServer } from "./server.js";

export interface HttpServerOptions {
  /** Base URL of the control plane the tools call. */
  baseUrl: string;
  port: number;
  /** Interface to bind. Defaults to 127.0.0.1. */
  host?: string;
  /** Endpoint path. Defaults to `/mcp`. */
  path?: string;
  version?: string;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

/**
 * Serves the MCP tools over Streamable HTTP in stateless mode. Each request must carry
 * `Authorization: Bearer <operator token>`; the token is forwarded to the control plane, so
 * this endpoint grants nothing the token does not already grant.
 */
export function startHttpServer(options: HttpServerOptions): Promise<Server> {
  const path = options.path ?? "/mcp";
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== path) {
      writeJson(res, 404, { error: "not found" });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      writeJson(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "method not allowed" }, id: null });
      return;
    }
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1];
    if (!token) {
      writeJson(res, 401, { jsonrpc: "2.0", error: { code: -32001, message: "missing bearer token" }, id: null });
      return;
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      writeJson(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "parse error" }, id: null });
      return;
    }

    const mcp = createWorkplaneMcpServer({ baseUrl: options.baseUrl, token, version: options.version });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void mcp.close();
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) {
        writeJson(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: String(error) }, id: null });
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host ?? "127.0.0.1", () => resolve(server));
  });
}
