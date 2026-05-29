import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["correct-playstation-congress-advancement.trycloudflare.com"],
};

export default nextConfig;
