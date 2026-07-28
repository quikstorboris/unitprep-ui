import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // A dedicated port (3100, not the dev default 3000) so this never
  // collides with a real `next dev` a developer might already have
  // running locally. No real backend is started -- every test mocks
  // its own API responses via page.route(), since these tests exist to
  // verify frontend behavior (state/remount correctness), not to
  // re-verify the backend the Rust test suite already covers.
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
