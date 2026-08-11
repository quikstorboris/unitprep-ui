import { expect, test, type Page, type Route } from "@playwright/test";

import { seedAuthenticatedSession } from "./helpers";

/**
 * Regression coverage for the state-scoping bug class this app has now
 * fixed four separate times across different routes (see brain/Gotchas
 * in the vault): a session-results page whose local/derived state only
 * resets on a full remount, reached via `key={sessionId}` on the page
 * component. Browser back/forward within a Next.js App Router app is a
 * genuine client-side (soft) transition, not a full reload -- exactly
 * the case where React would otherwise reuse the previous session's
 * component instance and its state if the route's `key` didn't differ.
 *
 * No real backend is used: /validate is mocked per session_id so this
 * test verifies frontend remount/state-scoping behavior in isolation
 * from backend correctness, which the Rust test suite already covers.
 */

const CLIENT_ID = "e2e-client";

function validateResponse(filesChecked: number) {
  return {
    files_checked: filesChecked,
    issue_count: 0,
    error_count: 0,
    warning_count: 0,
    issues: [],
    files_errored: [],
    ready: true,
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

async function mockValidateBySession(
  page: Page,
  responsesBySessionId: Record<string, unknown>
) {
  await page.route("**/validate", async (route: Route) => {
    // /validate is cross-origin from the app's own dev server
    // (127.0.0.1:8080 vs. 127.0.0.1:3100), and its JSON body makes it a
    // non-simple request per the CORS spec -- the real browser sends an
    // OPTIONS preflight with no body before the POST itself. Answering
    // only the POST and never the preflight leaves the preflight (and
    // so the whole fetch) hanging forever, which is exactly what a stuck
    // "Loading…" state without a request-method check looks like.
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const body = route.request().postDataJSON() as { session_id: string };
    const response = responsesBySessionId[body.session_id];

    await route.fulfill({
      json: response ?? { error: "unmocked session" },
      headers: CORS_HEADERS,
    });
  });
}

test("switching sessions via browser back/forward does not leak stale results", async ({
  page,
}) => {
  const sessionA = "session-a";
  const sessionB = "session-b";

  await seedAuthenticatedSession(page);

  // Clients are frontend-only state, scoped per tab in sessionStorage
  // (see lib/clients.tsx) -- no backend entity exists yet. addInitScript
  // re-runs before every navigation in this test, so the seeded client
  // survives page.goto() to a new route, not just the first load.
  await page.addInitScript(
    ([clientId]) => {
      sessionStorage.setItem(
        "unitprep:clients",
        JSON.stringify([
          {
            id: clientId,
            name: "E2E Test Client",
            contactName: "",
            contactEmail: "",
            contactPhone: "",
            signerName: "",
            bankAccount: "",
            address: "",
            dropboxPath: "",
            createdAt: Date.now(),
          },
        ])
      );
    },
    [CLIENT_ID]
  );

  await mockValidateBySession(page, {
    [sessionA]: validateResponse(111),
    [sessionB]: validateResponse(222),
  });

  await page.goto(`/clients/${CLIENT_ID}/unit-groups/${sessionA}`);
  await expect(page.getByText("111")).toBeVisible();
  await expect(page.getByText("222")).not.toBeVisible();

  await page.goto(`/clients/${CLIENT_ID}/unit-groups/${sessionB}`);
  await expect(page.getByText("222")).toBeVisible();
  await expect(page.getByText("111")).not.toBeVisible();

  // The bug this guards against: browser back is a client-side transition,
  // not a reload -- without key={sessionId}, React could reuse session B's
  // mounted ScanResultsPage instance and its stale local state instead of
  // genuinely re-fetching/re-deriving session A's own results.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/${sessionA}$`));
  await expect(page.getByText("111")).toBeVisible();
  await expect(page.getByText("222")).not.toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/${sessionB}$`));
  await expect(page.getByText("222")).toBeVisible();
  await expect(page.getByText("111")).not.toBeVisible();
});
