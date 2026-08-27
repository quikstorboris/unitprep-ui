import type { Page, Route } from "@playwright/test";

// Mirrors CORS_HEADERS in session-remount.spec.ts -- every cross-origin
// JSON POST route mocked here needs the same OPTIONS-preflight handling
// (see that file's comment for why). Access-Control-Expose-Headers
// mirrors the real backend's CorsLayer (src/api/mod.rs) -- without it,
// a mocked download response's Content-Disposition header is present on
// the wire but invisible to response.headers.get() in the browser,
// masking the exact real-world gap that header's presence on the real
// backend fixes.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

// Must match unitprep-api's SESSION_COOKIE_NAME (src/auth/session_cookie.rs)
// and proxy.ts's own duplicate of that constant. proxy.ts only checks
// this cookie's *presence*, never validity (see its own doc comment --
// real authorization happens server-side, per request) -- so any
// non-empty value clears its gate. Added after "Gate every route behind
// a real session" (3272691) landed without updating these helpers,
// which had silently broken every /clients/* E2E test.
//
// Clearing proxy.ts's gate isn't enough on its own, though:
// app/(app)/layout.tsx runs its own client-side check via
// useCurrentUser(), which calls the real GET /health/whoami and
// redirects to /login (or /onboarding/totp) the moment that call
// resolves to "nobody signed in" -- which it always does here, since no
// real backend exists in these tests. Both gates need defeating
// together, or the redirect just happens a moment later than the first
// one and every downstream assertion fails with an unrelated-looking
// "element not found" instead of an obvious auth error.
const SESSION_COOKIE_NAME = "unitprep_session";

async function seedSessionCookie(page: Page) {
  // Hardcoded to match playwright.config.ts's own baseURL -- same
  // precedent CORS_HEADERS above already sets for this file.
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: "e2e-fake-session-token",
      url: "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function seedWhoAmI(page: Page) {
  await page.route("**/health/whoami", async (route: Route) => {
    await route.fulfill({
      json: {
        user_id: "00000000-0000-0000-0000-000000000001",
        first_name: "E2E",
        last_name: "Admin",
        roles: ["admin"],
        permissions: [],
        totp_enrolled: true,
      },
      headers: CORS_HEADERS,
    });
  });
}

/** Clears both auth gates a /clients/* page sits behind -- see the
 * comment above SESSION_COOKIE_NAME for why both are needed together. */
export async function seedAuthenticatedSession(page: Page) {
  await seedSessionCookie(page);
  await seedWhoAmI(page);
}

export async function seedClient(
  page: Page,
  clientId: string,
  name = "E2E Test Client"
) {
  await seedAuthenticatedSession(page);

  await page.addInitScript(
    ([id, clientName]) => {
      sessionStorage.setItem(
        "unitprep:clients",
        JSON.stringify([
          {
            id,
            name: clientName,
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
    [clientId, name]
  );
}

export async function mockJsonPost(
  page: Page,
  urlGlob: string,
  respond: (body: Record<string, unknown>) => {
    status?: number;
    json: unknown;
  }
) {
  await page.route(urlGlob, async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const body = route.request().postDataJSON() as Record<string, unknown>;
    const { status = 200, json } = respond(body);

    await route.fulfill({ status, json, headers: CORS_HEADERS });
  });
}

/** Like mockJsonPost, for a GET endpoint with no request body to parse
 * -- e.g. lib/clientOps.ts's listQmsTags(). */
export async function mockJsonGet(
  page: Page,
  urlGlob: string,
  json: unknown
) {
  await page.route(urlGlob, async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({ json, headers: CORS_HEADERS });
  });
}

export async function mockBinaryPost(
  page: Page,
  urlGlob: string,
  options: { body: Buffer; contentType: string; filename: string }
) {
  await page.route(urlGlob, async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      body: options.body,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": options.contentType,
        "Content-Disposition": `attachment; filename="${options.filename}"`,
      },
    });
  });
}
