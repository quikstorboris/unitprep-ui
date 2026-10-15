import type { Page, Route } from "@playwright/test";

// The app's own origin under test (playwright.config.ts's baseURL) and the
// API origin it talks to (lib/api.ts's default API_URL). Both hardcoded to
// match, the same duplicated-by-convention coupling the rest of this file
// already has with the backend's cookie name.
const APP_ORIGIN = "http://127.0.0.1:3100";
const API_PORT = "8080";

// Every cross-origin JSON request needs an OPTIONS-preflight answer, and
// the app now uses PUT/PATCH/DELETE as well as GET/POST.
// Access-Control-Expose-Headers mirrors the real backend's CorsLayer
// (src/api/mod.rs) -- without it a mocked download's Content-Disposition
// is on the wire but invisible to response.headers.get() in the browser.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

// Must match unitprep-api's SESSION_COOKIE_NAME (src/auth/session_cookie.rs)
// and proxy.ts's own duplicate of that constant. proxy.ts only checks this
// cookie's *presence*, never validity -- any non-empty value clears its
// gate. The shell's own useCurrentUser() check (app/(app)/layout.tsx) calls
// GET /health/whoami and bounces to /login (or /onboarding/totp) when that
// says nobody is signed in, so both gates are defeated together here.
const SESSION_COOKIE_NAME = "unitprep_session";

export const E2E_USER = {
  user_id: "00000000-0000-0000-0000-000000000001",
  first_name: "E2E",
  last_name: "Admin",
  roles: ["admin"],
  permissions: [],
  totp_enrolled: true,
  step_up_required: false,
};

type ApiReply = {
  status?: number;
  json?: unknown;
  body?: Buffer;
  headers?: Record<string, string>;
};
type ApiHandler = (request: {
  method: string;
  body: Record<string, unknown> | undefined;
}) => ApiReply;

interface ApiRouter {
  handlers: Map<string, ApiHandler>;
  unmatched: string[];
}

const routers = new WeakMap<Page, ApiRouter>();

/**
 * One route handler per page for the whole API origin, with a registry keyed
 * by pathname (and optionally "METHOD /path"). Anything unregistered answers
 * 404 and is remembered, so a spec that hangs because the app grew a new
 * request can say exactly which one (see `unmatchedApiCalls`) instead of
 * timing out on an unrelated-looking "element not found".
 */
async function apiRouter(page: Page): Promise<ApiRouter> {
  const existing = routers.get(page);
  if (existing) return existing;

  const router: ApiRouter = { handlers: new Map(), unmatched: [] };
  routers.set(page, router);

  await page.route(
    (url) => url.port === API_PORT,
    async (route: Route) => {
      const request = route.request();
      const method = request.method();

      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      const path = new URL(request.url()).pathname;
      const handler =
        router.handlers.get(`${method} ${path}`) ?? router.handlers.get(path);

      if (!handler) {
        router.unmatched.push(`${method} ${path}`);
        if (process.env.E2E_DEBUG) {
          console.warn(`[e2e] unmocked API call: ${method} ${path}`);
        }
        await route.fulfill({
          status: 404,
          json: { message: `unmocked ${method} ${path}` },
          headers: CORS_HEADERS,
        });
        return;
      }

      let body: Record<string, unknown> | undefined;
      try {
        body = (request.postDataJSON() as Record<string, unknown>) ?? undefined;
      } catch {
        body = undefined;
      }

      const reply = handler({ method, body });
      await route.fulfill({
        status: reply.status ?? 200,
        ...(reply.body !== undefined ? { body: reply.body } : { json: reply.json ?? {} }),
        headers: { ...CORS_HEADERS, ...reply.headers },
      });
    }
  );

  return router;
}

/** Registers a mock for one API path. `path` is the pathname ("/validate")
 * or "METHOD /path" to tell verbs apart. Later registrations win. */
export async function mockApi(page: Page, path: string, handler: ApiHandler) {
  (await apiRouter(page)).handlers.set(path, handler);
}

/** API calls the app made that no mock answered, in order. */
export async function unmatchedApiCalls(page: Page): Promise<string[]> {
  return (await apiRouter(page)).unmatched;
}

async function seedSessionCookie(page: Page) {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: "e2e-fake-session-token",
      url: APP_ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Clears both auth gates a signed-in page sits behind. */
export async function seedAuthenticatedSession(
  page: Page,
  user: Record<string, unknown> = E2E_USER
) {
  await seedSessionCookie(page);
  await mockApi(page, "/health/whoami", () => ({ json: user }));
}

/** An authenticated session plus one real-shaped company in `GET /clients`
 * (the left nav and client layout read it). */
export async function seedClient(
  page: Page,
  clientId: string,
  name = "E2E Test Client"
) {
  await seedAuthenticatedSession(page);

  await mockApi(page, "GET /clients", () => ({
    json: [
      {
        id: clientId,
        legal_name: name,
        created_at: "2026-01-01T00:00:00Z",
        archived_at: null,
        implementation_completed_at: null,
        facility_names: ["E2E Facility"],
        implementation_manager: null,
        sales_rep: null,
      },
    ],
  }));
}

export async function mockJsonPost(
  page: Page,
  path: string,
  respond: (body: Record<string, unknown>) => {
    status?: number;
    json: unknown;
  }
) {
  await mockApi(page, `POST ${path}`, ({ body }) => respond(body ?? {}));
}

/** Like mockJsonPost, for a GET endpoint with no request body to parse. */
export async function mockJsonGet(page: Page, path: string, json: unknown) {
  await mockApi(page, `GET ${path}`, () => ({ json }));
}

export async function mockBinaryPost(
  page: Page,
  path: string,
  options: { body: Buffer; contentType: string; filename: string }
) {
  await mockApi(page, `POST ${path}`, () => ({
    body: options.body,
    headers: {
      "Content-Type": options.contentType,
      "Content-Disposition": `attachment; filename="${options.filename}"`,
    },
  }));
}
