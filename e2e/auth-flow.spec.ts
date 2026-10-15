import { expect, test, type Page } from "@playwright/test";

import { E2E_USER, mockApi, seedAuthenticatedSession } from "./helpers";

/**
 * The sign-in shell, end to end in a real browser: the signed-out redirect
 * and login form, the signed-in shell, and the new-browser TOTP step-up
 * gate. No real backend (every API call is mocked, like the other specs).
 * The passkey ceremony itself needs a hardware authenticator, so the login
 * test stops at the server refusing `login/begin`; sign-in success is
 * covered at the unit level and by hand.
 */

// The form-level error line. Not getByRole("alert") alone: Next's route
// announcer is also an alert and matches too.
function formError(page: Page) {
  return page.locator('p[role="alert"]');
}

test("a signed-out visit to a protected page lands on the sign-in form, and a refused sign-in shows its message", async ({
  page,
}) => {
  await mockApi(page, "/health/whoami", () => ({
    status: 401,
    json: { message: "not signed in" },
  }));
  await mockApi(page, "POST /auth/login/begin", () => ({
    status: 401,
    json: { message: "We couldn't sign you in with those details." },
  }));

  // No session cookie at all: proxy.ts redirects before the page renders.
  await page.goto("/clients");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill("someone@quikstor.com");
  await page.getByRole("button", { name: "Sign in with passkey" }).click();

  await expect(formError(page)).toHaveText(
    "We couldn't sign you in with those details."
  );
});

test("a signed-in session reaches an authenticated page inside the shell", async ({
  page,
}) => {
  await seedAuthenticatedSession(page);
  await mockApi(page, "GET /clients", () => ({ json: [] }));

  await page.goto("/clients");

  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
});

test("a session from an unfamiliar browser must pass the TOTP step-up before the app loads", async ({
  page,
}) => {
  let stepUpCleared = false;

  await seedAuthenticatedSession(page);
  // Later registration wins: whoami now reports the step-up requirement
  // until the (mocked) step-up call succeeds.
  await mockApi(page, "/health/whoami", () => ({
    json: { ...E2E_USER, step_up_required: !stepUpCleared },
  }));
  await mockApi(page, "GET /clients", () => ({ json: [] }));
  await mockApi(page, "POST /auth/totp/step-up", ({ body }) => {
    if (body?.code === "123456") {
      stepUpCleared = true;
      return { json: { confirmed: true } };
    }
    // A wrong code is a 400 on the real backend (`totp_code_rejected`) --
    // a 401 would be read as "session expired" and bounce to /login.
    return { status: 400, json: { message: "That code didn't work." } };
  });

  await page.goto("/clients");

  // The prompt replaces the shell: nothing else renders behind it.
  await expect(
    page.getByRole("heading", { name: "Confirm it's you" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clients" })).not.toBeVisible();

  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(formError(page)).toHaveText("That code didn't work.");

  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Confirm it's you" })
  ).not.toBeVisible();
});
