import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./libs/db/src/schema/sqlite.ts",
  out: "./libs/db/src/migrations/sqlite",
});
