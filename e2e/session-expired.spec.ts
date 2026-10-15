import { expect, test } from "@playwright/test";

import { mockJsonPost, seedClient } from "./helpers";

const CLIENT_ID = "e2e-client-expired";
const FACILITY_ID = "e2e-facility";
const SESSION_ID = "session-long-gone";

test("a 404 from /validate shows Session Expired, and Home returns to client info", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonPost(page, "/validate", () => ({
    status: 404,
    json: { error: "not_found", message: "session not found" },
  }));

  await mockJsonPost(page, "/session/cancel", () => ({
    json: {},
  }));

  await page.goto(`/clients/${CLIENT_ID}/facilities/${FACILITY_ID}/unit-groups/${SESSION_ID}`);

  await expect(page.getByText("Session Expired")).toBeVisible();

  await page.getByRole("button", { name: "Home" }).click();

  // Home from an expired scan session lands on the facility page.
  await expect(page).toHaveURL(
    new RegExp(`/clients/${CLIENT_ID}/facilities/${FACILITY_ID}$`)
  );
});
