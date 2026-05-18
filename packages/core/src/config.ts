import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  WORKPLANE_SERVER_PORT: z
    .string()
    .optional()
    .default("8787")
    .transform((value) => Number.parseInt(value, 10)),
  WORKPLANE_NODE_TOKEN: z.string().optional(),
});

const nodeEnvSchema = z.object({
  WORKPLANE_SERVER_URL: z.string().url().optional().default("http://localhost:8787"),
  WORKPLANE_NODE_NAME: z.string().optional().default("local-node-1"),
  WORKPLANE_NODE_CAPABILITIES: z
    .string()
    .optional()
    .default("shell,git,node,typescript,aider"),
  WORKPLANE_POLL_INTERVAL_MS: z
    .string()
    .optional()
    .default("3000")
    .transform((value) => Number.parseInt(value, 10)),
});

export interface ServerConfig {
  databaseUrl: string;
  port: number;
  nodeToken?: string;
}

export interface NodeConfig {
  serverUrl: string;
  nodeName: string;
  nodeCapabilities: string[];
  pollIntervalMs: number;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = serverEnvSchema.parse(env);

  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.WORKPLANE_SERVER_PORT,
    nodeToken: parsed.WORKPLANE_NODE_TOKEN,
  };
}

export function loadNodeConfig(env: NodeJS.ProcessEnv = process.env): NodeConfig {
  const parsed = nodeEnvSchema.parse(env);

  return {
    serverUrl: parsed.WORKPLANE_SERVER_URL,
    nodeName: parsed.WORKPLANE_NODE_NAME,
    nodeCapabilities: parseCsv(parsed.WORKPLANE_NODE_CAPABILITIES),
    pollIntervalMs: parsed.WORKPLANE_POLL_INTERVAL_MS,
  };
}

export function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

