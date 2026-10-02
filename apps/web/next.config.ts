import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  // The workspace libraries are TypeScript source outside this directory.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: ["@workplane/client", "@workplane/types", "@workplane/ui"],
  // The libraries use NodeNext-style imports ("./client.js" for client.ts). Turbopack cannot map
  // those yet, so the app builds with webpack (`next build --webpack`) and this alias.
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return webpackConfig;
  },
};

export default config;
