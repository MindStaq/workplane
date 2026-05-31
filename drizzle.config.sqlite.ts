import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/db/src/schema/sqlite.ts",
  out: "./packages/db/src/migrations/sqlite",
});
