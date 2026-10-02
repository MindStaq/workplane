import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { workspaceAliases } from "../../vitest.shared";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAliases() },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
