import { expect, test, type Page, type Route } from "@playwright/test";

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

async function mockValidateBySession(
  page: Page,
  responsesBySessionId: Record<string, unknown>
) {
  await page.route("**/validate", async (route: Route) => {
    const body = route.request().postDataJSON() as { session_id: string };
    const response = responsesBySessionId[body.session_id];

    await route.fulfill({ json: response ?? { error: "unmocked session" } });
  });
}

test("switching sessions via browser back/forward does not leak stale results", async ({
  page,
}) => {
  const sessionA = "session-a";
  const sessionB = "session-b";

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
