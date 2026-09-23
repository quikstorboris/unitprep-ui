import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import {
  UNSUPPORTED_BROWSER_MESSAGE,
  hasPermission,
  loginBegin,
  loginFinish,
  logout,
  logoutEverywhere,
  passkeyReverify,
  registerPasskey,
  totpEnrollBegin,
  totpEnrollConfirm,
  totpStepUp,
  whoAmI,
  type WhoAmI,
} from "./auth-session";

function user(overrides: Partial<WhoAmI> = {}): WhoAmI {
  return {
    user_id: "u1",
    first_name: "Ada",
    last_name: "Lovelace",
    roles: ["onboarding_manager"],
    permissions: ["client_ops.perform"],
    totp_enrolled: true,
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("is true when the user's permissions include the key", () => {
    expect(hasPermission(user({ permissions: ["users.manage"] }), "users.manage")).toBe(
      true
    );
  });

  it("is false when the user's permissions do not include the key", () => {
    expect(
      hasPermission(user({ permissions: ["client_ops.perform"] }), "users.manage")
    ).toBe(false);
  });

  it("is false for a null user (nobody signed in)", () => {
    expect(hasPermission(null, "users.manage")).toBe(false);
  });
});

describe("whoAmI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns kind: ok with the signed-in user on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(user()), { status: 200 }))
    );

    const result = await whoAmI();

    expect(result).toEqual({ kind: "ok", data: user() });
  });

  it("requests credentials: include against /health/whoami", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(user()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await whoAmI();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/health/whoami`);
    expect(init).toMatchObject({ credentials: "include" });
  });

  it("returns kind: unauthorized, not an exception, for a 401 (nobody signed in)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Sign in required" }), {
          status: 401,
        })
      )
    );

    const result = await whoAmI();

    expect(result).toEqual({ kind: "unauthorized", message: "Sign in required" });
  });

  it("returns kind: error when the network call itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await whoAmI();

    expect(result.kind).toBe("error");
  });
});

describe("thin auth-shared wrappers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loginBegin posts the email to /auth/login/begin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ challenge: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await loginBegin("ada@example.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/login/begin`);
    expect(JSON.parse(init.body)).toEqual({ email: "ada@example.com" });
  });

  it("totpEnrollBegin hits /auth/totp/enroll/begin with no body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ provisioning_uri: "otpauth://", secret: "s" }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await totpEnrollBegin();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/totp/enroll/begin`);
    expect(result).toEqual({
      kind: "ok",
      data: { provisioning_uri: "otpauth://", secret: "s" },
    });
  });

  it("totpEnrollConfirm posts the code to /auth/totp/enroll/confirm", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ confirmed: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await totpEnrollConfirm("123456");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/totp/enroll/confirm`);
    expect(JSON.parse(init.body)).toEqual({ code: "123456" });
  });

  it("totpStepUp posts the code to /auth/totp/step-up", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ confirmed: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await totpStepUp("654321");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/totp/step-up`);
    expect(JSON.parse(init.body)).toEqual({ code: "654321" });
  });

  it("logout hits /auth/logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, revoked_count: 1 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/logout`);
  });

  it("logoutEverywhere hits /auth/logout/everywhere", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, revoked_count: 3 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await logoutEverywhere();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/logout/everywhere`);
  });
});

// jsdom does not implement the WebAuthn Level 3 conversion helpers this
// module relies on (PublicKeyCredential.parseCreationOptionsFromJSON /
// .parseRequestOptionsFromJSON) -- undefined by default here, the same
// as a real but outdated browser, which is exactly the case
// UNSUPPORTED_BROWSER_MESSAGE exists to handle. The "supported" tests
// below stub both PublicKeyCredential and navigator.credentials back in
// deliberately, then restore jsdom's real (absent) shape afterwards so
// that default-unsupported behavior stays covered for every other test
// in this file.
type StubbedCredential = { toJSON: () => unknown };

function stubWebauthnSupport() {
  Object.defineProperty(window, "PublicKeyCredential", {
    value: {
      parseCreationOptionsFromJSON: vi.fn((options: unknown) => options),
      parseRequestOptionsFromJSON: vi.fn((options: unknown) => options),
    },
    configurable: true,
    writable: true,
  });
}

function stubCredentialsContainer(credential: StubbedCredential | null) {
  const create = vi.fn().mockResolvedValue(credential);
  const get = vi.fn().mockResolvedValue(credential);
  Object.defineProperty(navigator, "credentials", {
    value: { create, get },
    configurable: true,
  });
  return { create, get };
}

describe("registerPasskey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test-only cleanup of a stub defined above.
    delete window.PublicKeyCredential;
  });

  it("returns UNSUPPORTED_BROWSER_MESSAGE when the browser lacks WebAuthn support", async () => {
    const result = await registerPasskey("token-1");
    expect(result).toEqual({ kind: "error", message: UNSUPPORTED_BROWSER_MESSAGE });
  });

  it("completes the begin/finish round trip and reports whether a session was issued", async () => {
    stubWebauthnSupport();
    const credential: StubbedCredential = { toJSON: () => ({ id: "cred-1" }) };
    stubCredentialsContainer(credential);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: { publicKey: {} } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, session_issued: true }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await registerPasskey("token-1", "My laptop");

    expect(result).toEqual({ kind: "ok", data: { sessionIssued: true } });
    const [, finishInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(finishInit.body)).toEqual({
      credential: { id: "cred-1" },
      nickname: "My laptop",
    });
  });

  it("omits invite_token entirely for an already-signed-in caller adding a second passkey", async () => {
    stubWebauthnSupport();
    stubCredentialsContainer({ toJSON: () => ({ id: "cred-1" }) });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: { publicKey: {} } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, session_issued: false }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await registerPasskey();

    const [, beginInit] = fetchMock.mock.calls[0];
    expect(beginInit.body).toBe("{}");
  });

  it("returns an error when the ceremony is cancelled, without calling finish", async () => {
    stubWebauthnSupport();
    Object.defineProperty(navigator, "credentials", {
      value: {
        create: vi.fn().mockRejectedValue(new Error("The operation either timed out or was not allowed.")),
      },
      configurable: true,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ challenge: { publicKey: {} } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await registerPasskey("token-1");

    expect(result).toEqual({
      kind: "error",
      message: "The operation either timed out or was not allowed.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a failure from the begin step without attempting to create a credential", async () => {
    stubWebauthnSupport();
    const { create } = stubCredentialsContainer({ toJSON: () => ({}) });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "invalid invite" }), { status: 400 })
      )
    );

    const result = await registerPasskey("bad-token");

    expect(result).toEqual({ kind: "error", message: "invalid invite" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("loginFinish", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test-only cleanup of a stub defined above.
    delete window.PublicKeyCredential;
  });

  it("returns UNSUPPORTED_BROWSER_MESSAGE when the browser lacks WebAuthn support", async () => {
    const result = await loginFinish({ challenge: { publicKey: {} } });
    expect(result).toEqual({ kind: "error", message: UNSUPPORTED_BROWSER_MESSAGE });
  });

  it("completes the assertion and posts it to /auth/login/finish", async () => {
    stubWebauthnSupport();
    stubCredentialsContainer({ toJSON: () => ({ id: "cred-1" }) });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loginFinish({ challenge: { publicKey: {} } });

    expect(result).toEqual({ kind: "ok", data: { success: true } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/login/finish`);
    expect(JSON.parse(init.body)).toEqual({ credential: { id: "cred-1" } });
  });

  it("returns an error when no credential is produced", async () => {
    stubWebauthnSupport();
    stubCredentialsContainer(null);
    vi.stubGlobal("fetch", vi.fn());

    const result = await loginFinish({ challenge: { publicKey: {} } });

    expect(result).toEqual({ kind: "error", message: "No passkey response was produced." });
  });
});

describe("passkeyReverify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test-only cleanup of a stub defined above.
    delete window.PublicKeyCredential;
  });

  it("returns UNSUPPORTED_BROWSER_MESSAGE when the browser lacks WebAuthn support", async () => {
    const result = await passkeyReverify();
    expect(result).toEqual({ kind: "error", message: UNSUPPORTED_BROWSER_MESSAGE });
  });

  it("completes the begin/finish round trip against the reverify endpoints", async () => {
    stubWebauthnSupport();
    stubCredentialsContainer({ toJSON: () => ({ id: "cred-1" }) });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: { publicKey: {} } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: true }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await passkeyReverify();

    expect(result).toEqual({ kind: "ok", data: { verified: true } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/reverify/begin`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/auth/reverify/finish`);
  });

  it("propagates a failure from the begin step without attempting to verify a credential", async () => {
    stubWebauthnSupport();
    const { get } = stubCredentialsContainer({ toJSON: () => ({}) });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Sign in required" }), { status: 401 })
      )
    );

    const result = await passkeyReverify();

    expect(result.kind).toBe("unauthorized");
    expect(get).not.toHaveBeenCalled();
  });
});
