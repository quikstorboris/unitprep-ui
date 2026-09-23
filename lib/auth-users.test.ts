import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import {
  createInvite,
  disableUser,
  exportUsersCsv,
  grantRole,
  listRoles,
  listUsers,
  reactivateUser,
  recoverAccount,
  revokeRole,
} from "./auth-users";

describe("auth-users", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("listUsers GETs /auth/users", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listUsers();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/users`);
    expect(init.method).toBe("GET");
  });

  it("listRoles GETs /auth/roles", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ roles: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listRoles();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/roles`);
  });

  it("exportUsersCsv GETs /auth/users/export and returns the raw response for download", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("id,email", {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="users.csv"' },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await exportUsersCsv();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/users/export`);
    expect(result.kind).toBe("ok");
  });

  it("createInvite posts the full request body to /auth/invites", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ user_id: "u1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createInvite({
      email: "ada@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      company: "quikstor",
      role: "onboarding_manager",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/invites`);
    expect(JSON.parse(init.body)).toEqual({
      email: "ada@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      company: "quikstor",
      role: "onboarding_manager",
    });
  });

  it("recoverAccount posts the email to /auth/invites/recover", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ user_id: "u1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await recoverAccount("ada@example.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/invites/recover`);
    expect(JSON.parse(init.body)).toEqual({ email: "ada@example.com" });
  });

  it("disableUser posts to /auth/users/{id}/deactivate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_id: "u1", status: "deactivated" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await disableUser("u1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/users/u1/deactivate`);
    expect(init.method).toBe("POST");
  });

  it("reactivateUser posts to /auth/users/{id}/reactivate", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ user_id: "u1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await reactivateUser("u1");

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/users/u1/reactivate`);
  });

  it("grantRole posts the role to /auth/users/{id}/roles", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_id: "u1", roles: ["admin"] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await grantRole("u1", "admin");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/users/u1/roles`);
    expect(JSON.parse(init.body)).toEqual({ role: "admin" });
  });

  it("revokeRole sends a DELETE to /auth/users/{id}/roles/{role}, URL-encoded", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_id: "u1", roles: [] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await revokeRole("u1", "onboarding manager");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/users/u1/roles/onboarding%20manager`);
    expect(init.method).toBe("DELETE");
  });
});
