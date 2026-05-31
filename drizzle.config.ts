import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/src/schema/pg.ts",
  out: "./packages/db/src/migrations/pg",
});
