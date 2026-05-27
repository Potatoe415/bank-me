import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["clark-iron-chart-circus.trycloudflare.com"],
};

export default nextConfig;
