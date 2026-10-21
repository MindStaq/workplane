#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startHttpServer } from "./http.js";
import { createWorkplaneMcpServer } from "./server.js";

declare const __WORKPLANE_MCP_VERSION__: string | undefined;
const version = typeof __WORKPLANE_MCP_VERSION__ === "string" ? __WORKPLANE_MCP_VERSION__ : "dev";

const HELP = `workplane-mcp — MCP server for a Workplane fleet

Usage:
  workplane-mcp                         stdio transport (for Claude Code, Cursor and other local clients)
  workplane-mcp --http [--port 8788] [--host 127.0.0.1]
                                        Streamable HTTP at /mcp; callers send their operator token as a bearer token

Env:
  WORKPLANE_SERVER_URL       control plane URL (default http://localhost:8787)
  WORKPLANE_OPERATOR_TOKEN   operator token used by the stdio transport
  WORKPLANE_MCP_PORT         HTTP port (default 8788)
`;

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  const baseUrl = process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787";

  if (args.includes("--http")) {
    const port = Number(flag(args, "--port") ?? process.env.WORKPLANE_MCP_PORT ?? 8788);
    const host = flag(args, "--host") ?? "127.0.0.1";
    await startHttpServer({ baseUrl, port, host, version });
    process.stderr.write(`workplane-mcp ${version}: Streamable HTTP on http://${host}:${port}/mcp -> ${baseUrl}\n`);
    return;
  }

  // stdout carries the protocol, so diagnostics go to stderr.
  const server = createWorkplaneMcpServer({ baseUrl, token: process.env.WORKPLANE_OPERATOR_TOKEN, version });
  await server.connect(new StdioServerTransport());
  process.stderr.write(`workplane-mcp ${version}: stdio -> ${baseUrl}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
