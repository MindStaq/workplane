import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./libs/db/src/schema/pg.ts",
  out: "./libs/db/src/migrations/pg",
});
