import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],

  // Pin the workspace root. Without this Turbopack walks up and finds the
  // package-lock.json in the home directory, then warns about the ambiguity.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
