import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  notifyUnauthorized as notifyUnauthorizedType,
  onUnauthorized as onUnauthorizedType,
} from "./sessionExpiry";

// listeners lives in this module's own top-level Set, shared by every
// caller that imports it -- a fresh module per test (same
// vi.resetModules()+dynamic-import pattern lib/clients.test.tsx already
// uses for its own module-level singleton) keeps one test's listener
// from leaking into the next's assertions.
async function freshSessionExpiryModule() {
  vi.resetModules();
  const mod = await import("./sessionExpiry");
  return mod as {
    notifyUnauthorized: typeof notifyUnauthorizedType;
    onUnauthorized: typeof onUnauthorizedType;
  };
}

describe("onUnauthorized / notifyUnauthorized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls every registered listener when notifyUnauthorized fires", async () => {
    const { onUnauthorized, notifyUnauthorized } =
      await freshSessionExpiryModule();
    const first = vi.fn();
    const second = vi.fn();
    onUnauthorized(first);
    onUnauthorized(second);

    notifyUnauthorized();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops calling a listener once its unsubscribe function runs", async () => {
    const { onUnauthorized, notifyUnauthorized } =
      await freshSessionExpiryModule();
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    notifyUnauthorized();
    unsubscribe();
    notifyUnauthorized();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing one listener does not affect another", async () => {
    const { onUnauthorized, notifyUnauthorized } =
      await freshSessionExpiryModule();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = onUnauthorized(first);
    onUnauthorized(second);

    unsubscribeFirst();
    notifyUnauthorized();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no listener is registered", async () => {
    const { notifyUnauthorized } = await freshSessionExpiryModule();
    expect(() => notifyUnauthorized()).not.toThrow();
  });
});
