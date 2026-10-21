export interface SetupField {
  key: SetupKey;
  flag: string;
  envVar: string;
  label: string;
}

export type SetupKey = "databaseUrl" | "port" | "serverUrl" | "nodeToken" | "operatorToken";

/** Prompt order matters: the server URL default depends on the port. */
export const SETUP_FIELDS: readonly SetupField[] = [
  { key: "databaseUrl", flag: "--database-url", envVar: "DATABASE_URL", label: "DATABASE_URL         " },
  { key: "port", flag: "--port", envVar: "WORKPLANE_SERVER_PORT", label: "Server port          " },
  { key: "serverUrl", flag: "--server-url", envVar: "WORKPLANE_SERVER_URL", label: "Server URL (for nodes)" },
  { key: "nodeToken", flag: "--node-token", envVar: "WORKPLANE_NODE_TOKEN", label: "Node token           " },
  { key: "operatorToken", flag: "--operator-token", envVar: "WORKPLANE_OPERATOR_TOKEN", label: "Operator token       " },
];

export interface SetupArgs {
  values: Partial<Record<SetupKey, string>>;
  nonInteractive: boolean;
  migrate: boolean;
  help: boolean;
}

export function parseSetupArgs(argv: string[]): SetupArgs {
  const args: SetupArgs = { values: {}, nonInteractive: false, migrate: true, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [name, inline] = arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    if (name === "--yes" || name === "-y" || name === "--non-interactive") {
      args.nonInteractive = true;
      continue;
    }
    if (name === "--no-migrate") {
      args.migrate = false;
      continue;
    }
    if (name === "--help" || name === "-h") {
      args.help = true;
      continue;
    }
    const field = SETUP_FIELDS.find((candidate) => candidate.flag === name);
    if (!field) {
      throw new Error(`unknown option: ${name} (see workplane-setup --help)`);
    }
    const value = inline ?? argv[index + 1];
    if (value === undefined || (inline === undefined && value.startsWith("--"))) {
      throw new Error(`${name} needs a value`);
    }
    if (inline === undefined) {
      index += 1;
    }
    args.values[field.key] = value;
  }
  if (args.values.port !== undefined && !/^\d+$/.test(args.values.port)) {
    throw new Error(`--port must be a number, got ${args.values.port}`);
  }
  return args;
}

/**
 * The value shown (interactive) or used (non-interactive) when no flag was given:
 * environment variable in non-interactive mode, then the existing config file, then the built-in default.
 */
export function defaultFor(
  field: SetupField,
  context: {
    nonInteractive: boolean;
    env: Record<string, string | undefined>;
    existing: Record<string, string>;
    resolved: Partial<Record<SetupKey, string>>;
    generateToken: () => string;
  },
): string {
  const fromEnv = context.nonInteractive ? context.env[field.envVar]?.trim() : undefined;
  if (fromEnv) {
    return fromEnv;
  }
  const fromFile = context.existing[field.envVar];
  if (fromFile) {
    return fromFile;
  }
  switch (field.key) {
    case "databaseUrl":
      return "sqlite://~/.workplane/workplane.db";
    case "port":
      return "8787";
    case "serverUrl":
      return `http://localhost:${context.resolved.port ?? "8787"}`;
    case "nodeToken":
    case "operatorToken":
      return context.generateToken();
  }
}

export const SETUP_HELP = `Usage: workplane-setup [options]

Writes ~/.workplane/.env and runs database migrations. Without options it asks for each value.

Options:
${SETUP_FIELDS.map((field) => `  ${`${field.flag} <value>`.padEnd(26)} (env: ${field.envVar})`).join("\n")}
  -y, --yes, --non-interactive  Do not prompt; use flags, then env vars, then the existing config, then defaults
  --no-migrate               Write the config without running migrations
  -h, --help                 Show this help
`;
