import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useCurrentUser } = vi.hoisted(() => ({ useCurrentUser: vi.fn() }));
vi.mock("@/lib/currentUser", () => ({ useCurrentUser }));

import { notifyWriteSucceeded } from "@/lib/writeEvents";

import QueryProvider from "./QueryProvider";

let client: QueryClient;
function Capture() {
  const current = useQueryClient();
  useEffect(() => {
    client = current;
  }, [current]);
  return null;
}

function signedIn(userId: string) {
  useCurrentUser.mockReturnValue({ user: { user_id: userId }, checked: true });
}

function mount() {
  return render(
    <QueryProvider>
      <Capture />
    </QueryProvider>,
  );
}

const hasCompany = () => client.getQueryData(["company", "c1"]) !== undefined;

beforeEach(() => {
  useCurrentUser.mockReset();
});

describe("QueryProvider", () => {
  it("keeps cached data while the same user stays signed in", () => {
    signedIn("u1");
    const { rerender } = mount();
    client.setQueryData(["company", "c1"], { legal_name: "Prairie" });

    rerender(
      <QueryProvider>
        <Capture />
      </QueryProvider>,
    );

    expect(hasCompany()).toBe(true);
  });

  it("empties the cache when the user signs out", () => {
    signedIn("u1");
    const { rerender } = mount();
    client.setQueryData(["company", "c1"], { legal_name: "Prairie" });

    useCurrentUser.mockReturnValue({ user: null, checked: true });
    rerender(
      <QueryProvider>
        <Capture />
      </QueryProvider>,
    );

    expect(hasCompany()).toBe(false);
  });

  it("empties the cache when a different user turns out to be signed in", () => {
    signedIn("u1");
    const { rerender } = mount();
    client.setQueryData(["company", "c1"], { legal_name: "Prairie" });

    signedIn("u2");
    rerender(
      <QueryProvider>
        <Capture />
      </QueryProvider>,
    );

    expect(hasCompany()).toBe(false);
  });

  it("marks a company's cached reads stale after a write under it, without refetching", () => {
    signedIn("u1");
    mount();
    client.setQueryData(["company", "c1"], { legal_name: "Prairie" });
    client.setQueryData(["company", "c1", "facility", "f1", "policies"], { id: "p1" });
    client.setQueryData(["company", "c2"], { legal_name: "Westpark" });
    const fetches = vi.fn();
    client.getQueryCache().subscribe((event) => {
      if (event.type === "observerResultsUpdated") fetches();
    });

    notifyWriteSucceeded("/clients/c1/facilities/f1/policies/fees");

    expect(client.getQueryState(["company", "c1"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["company", "c1", "facility", "f1", "policies"])?.isInvalidated).toBe(true);
    // Another company's cache, and the data itself, are untouched.
    expect(client.getQueryState(["company", "c2"])?.isInvalidated).toBe(false);
    expect(hasCompany()).toBe(true);
    expect(fetches).not.toHaveBeenCalled();
  });

  it("ignores a write that is not under /clients/<id>", () => {
    signedIn("u1");
    mount();
    client.setQueryData(["company", "c1"], { legal_name: "Prairie" });

    notifyWriteSucceeded("/integrations/clickup/token");

    expect(client.getQueryState(["company", "c1"])?.isInvalidated).toBe(false);
  });

  it("does not empty anything while the first sign-in check is still running", () => {
    useCurrentUser.mockReturnValue({ user: null, checked: false });
    const { rerender } = mount();
    client.setQueryData(["company", "c1"], { legal_name: "Prairie" });

    rerender(
      <QueryProvider>
        <Capture />
      </QueryProvider>,
    );

    expect(hasCompany()).toBe(true);
  });
});
