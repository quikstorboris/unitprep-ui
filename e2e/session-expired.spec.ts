import { expect, test } from "@playwright/test";

import { mockJsonPost, seedClient } from "./helpers";

const CLIENT_ID = "e2e-client-expired";
const SESSION_ID = "session-long-gone";

test("a 404 from /validate shows Session Expired, and Home returns to client info", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonPost(page, "http://localhost:8080/validate", () => ({
    status: 404,
    json: { error: "not_found", message: "session not found" },
  }));

  await mockJsonPost(page, "http://localhost:8080/session/cancel", () => ({
    json: {},
  }));

  await page.goto(`/clients/${CLIENT_ID}/unit-groups/${SESSION_ID}`);

  await expect(page.getByText("Session Expired")).toBeVisible();

  await page.getByRole("button", { name: "Home" }).click();

  await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}/info$`));
  await expect(page.getByText("Client Details")).toBeVisible();
});
