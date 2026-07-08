import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    // Read once at build time from package.json — bumping the version
    // there is the only thing needed to keep this in sync, same as
    // unitprep-api's CARGO_PKG_VERSION on GET /health.
    NEXT_PUBLIC_APP_VERSION:
      packageJson.version,
  },
};

export default nextConfig;
