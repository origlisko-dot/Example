import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Pin the workspace root so Next doesn't infer a stray lockfile in the home dir.
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  transpilePackages: ["@pelozen/shared"],
};

export default nextConfig;
