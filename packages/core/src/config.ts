import { z } from "zod";
import { loadLocalEnv } from "./env.js";

loadLocalEnv();

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().optional().default("sqlite://./workplane.db"),
  WORKPLANE_SERVER_PORT: z
    .string()
    .optional()
    .default("8787")
    .transform((value) => Number.parseInt(value, 10)),
  WORKPLANE_NODE_TOKEN: z.string().optional(),
  WORKPLANE_OPERATOR_TOKEN: z.string().optional(),
  WORKPLANE_ENV_ALLOWLIST: z.string().optional(),
});

const nodeEnvSchema = z.object({
  WORKPLANE_SERVER_URL: z.string().url().optional().default("http://localhost:8787"),
  WORKPLANE_NODE_NAME: z.string().optional().default("local-node-1"),
  WORKPLANE_NODE_ID: z.string().optional(),
  WORKPLANE_NODE_CAPABILITIES: z
    .string()
    .optional()
    .default("shell,git,node,typescript,aider,ollama,codex,claude-code"),
  WORKPLANE_NODE_TOKEN: z.string().optional(),
  WORKPLANE_POLL_INTERVAL_MS: z
    .string()
    .optional()
    .default("3000")
    .transform((value) => Number.parseInt(value, 10)),
  WORKPLANE_ENV_ALLOWLIST: z.string().optional(),
});

export interface ServerConfig {
  databaseUrl: string;
  port: number;
  nodeToken?: string;
  operatorToken?: string;
  envAllowlist: string[];
}

export interface NodeConfig {
  serverUrl: string;
  nodeName: string;
  nodeId?: string;
  nodeCapabilities: string[];
  nodeToken?: string;
  pollIntervalMs: number;
  envAllowlist: string[];
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = serverEnvSchema.parse(env);

  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.WORKPLANE_SERVER_PORT,
    nodeToken: parsed.WORKPLANE_NODE_TOKEN,
    operatorToken: parsed.WORKPLANE_OPERATOR_TOKEN,
    envAllowlist: parseCsv(parsed.WORKPLANE_ENV_ALLOWLIST ?? ""),
  };
}

export function loadNodeConfig(env: NodeJS.ProcessEnv = process.env): NodeConfig {
  const parsed = nodeEnvSchema.parse(env);

  return {
    serverUrl: parsed.WORKPLANE_SERVER_URL,
    nodeName: parsed.WORKPLANE_NODE_NAME,
    nodeId: parsed.WORKPLANE_NODE_ID,
    nodeCapabilities: parseCsv(parsed.WORKPLANE_NODE_CAPABILITIES),
    nodeToken: parsed.WORKPLANE_NODE_TOKEN,
    pollIntervalMs: parsed.WORKPLANE_POLL_INTERVAL_MS,
    envAllowlist: parseCsv(parsed.WORKPLANE_ENV_ALLOWLIST ?? ""),
  };
}

export function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
