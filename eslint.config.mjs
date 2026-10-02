import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";

/**
 * The only rule enforced here is the Nx module-boundary rule. It keeps the dependency graph
 * honest: libraries cannot depend on apps, browser code cannot reach Node-only code, and
 * publishable packages cannot depend on private projects. See docs/plans/NX_MIGRATION_PLAN.md.
 */
export default [
  { ignores: ["**/dist", "**/node_modules", "**/.nx", "**/.next", "website/**", "scripts/**", "design/**"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "@nx": nx },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: false,
          // Shared test-tooling helper at the repository root (not a project).
          allow: ["^\\.\\./\\.\\./vitest\\.shared$"],
          depConstraints: [
            { sourceTag: "type:lib", onlyDependOnLibsWithTags: ["type:lib"] },
            { sourceTag: "type:app", onlyDependOnLibsWithTags: ["type:lib"] },
            { sourceTag: "type:bundle", onlyDependOnLibsWithTags: ["type:app", "type:lib"] },
            { sourceTag: "runtime:universal", onlyDependOnLibsWithTags: ["runtime:universal"] },
            {
              sourceTag: "runtime:browser",
              onlyDependOnLibsWithTags: ["runtime:universal", "runtime:browser"],
              bannedExternalImports: ["node-pty", "better-sqlite3", "pg", "drizzle-orm", "dotenv", "@dbos-inc/*"],
            },
            { sourceTag: "publish:npm", onlyDependOnLibsWithTags: ["publish:npm"] },
            { sourceTag: "scope:core", onlyDependOnLibsWithTags: ["scope:core"] },
            { sourceTag: "scope:adapter", onlyDependOnLibsWithTags: ["scope:adapter", "scope:core"] },
            { sourceTag: "scope:workplans", onlyDependOnLibsWithTags: ["scope:workplans", "scope:core"] },
            { sourceTag: "scope:data", onlyDependOnLibsWithTags: ["scope:data", "scope:core"] },
          ],
        },
      ],
    },
  },
  {
    // These two published libraries import a sibling's types by relative path on purpose: the
    // published .d.ts files inline those types. Importing by package name would change the
    // published declaration files and require new published dependencies, so this waits until
    // after the restructure release.
    files: ["libs/workplans/src/scheduler.ts", "libs/dbos/src/scheduler.ts"],
    rules: { "@nx/enforce-module-boundaries": "off" },
  },
];
