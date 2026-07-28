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
  // Dev-server-only (has no effect on `next build`/`next start`) --
  // Playwright's E2E suite runs `next dev` on 127.0.0.1:3100 rather than
  // localhost:3000, which Next 16's dev-origin check otherwise blocks by
  // default as a CSRF-adjacent safety measure.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
