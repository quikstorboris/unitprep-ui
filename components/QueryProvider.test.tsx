import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useCurrentUser } = vi.hoisted(() => ({ useCurrentUser: vi.fn() }));
vi.mock("@/lib/currentUser", () => ({ useCurrentUser }));

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
