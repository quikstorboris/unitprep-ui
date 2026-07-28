import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Playwright's E2E specs live under e2e/ and run through
    // `@playwright/test`, not Vitest -- excluded so `vitest run` never
    // tries (and fails) to execute them as unit tests.
    exclude: ["node_modules/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": dirname,
    },
  },
});
