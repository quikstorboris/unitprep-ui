import type { Page, Route } from "@playwright/test";

// Mirrors CORS_HEADERS in session-remount.spec.ts -- every cross-origin
// JSON POST route mocked here needs the same OPTIONS-preflight handling
// (see that file's comment for why).
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function seedClient(
  page: Page,
  clientId: string,
  name = "E2E Test Client"
) {
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
