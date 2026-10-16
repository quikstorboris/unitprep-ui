import { describe, expect, it } from "vitest";
import { redactUrl, scrubEvent } from "./sentryOptions";

describe("redactUrl", () => {
  it("replaces the invite token wherever it appears in a URL", () => {
    expect(redactUrl("https://x.test/invites/abc123?next=1")).toBe(
      "https://x.test/invites/[token]?next=1"
    );
    expect(redactUrl("/invites/abc123/recover")).toBe(
      "/invites/[token]/recover"
    );
  });

  it("leaves other URLs alone", () => {
    expect(redactUrl("/clients/42/facilities")).toBe(
      "/clients/42/facilities"
    );
  });
});

describe("scrubEvent", () => {
  it("strips request PII, credential headers and the invite token", () => {
    const event = scrubEvent({
      transaction: "/invites/secret-token",
      request: {
        url: "https://x.test/invites/secret-token?email=a@b.c",
        data: { email: "a@b.c" },
        cookies: { unitprep_session: "s" },
        query_string: "email=a@b.c",
        headers: { Cookie: "s", Authorization: "Bearer x", "User-Agent": "ua" },
      },
      breadcrumbs: [{ data: { url: "/invites/secret-token", status: 200 } }],
      user: { email: "a@b.c" },
    });

    expect(event.transaction).toBe("/invites/[token]");
    expect(event.request?.url).toBe("https://x.test/invites/[token]?email=a@b.c");
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.headers).toEqual({ "User-Agent": "ua" });
    expect(event.breadcrumbs?.[0].data).toEqual({
      url: "/invites/[token]",
      status: 200,
    });
    expect(event.user).toBeUndefined();
  });
});
