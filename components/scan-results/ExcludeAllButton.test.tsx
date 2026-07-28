import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExcludeAllButton } from "./ExcludeAllButton";
import type { ValidateResponse } from "@/types/api";

function baseResults(): ValidateResponse {
  return {
    files_checked: 1,
    issue_count: 0,
    error_count: 0,
    warning_count: 0,
    issues: [],
    files_errored: [],
    ready: true,
  };
}

describe("ExcludeAllButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the group count in its label", () => {
    render(
      <ExcludeAllButton
        sessionId="s1"
        groupNames={["A", "B", "C"]}
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Exclude All (3)" })
    ).toBeInTheDocument();
  });

  it("is disabled when there are no groups to exclude", () => {
    render(
      <ExcludeAllButton
        sessionId="s1"
        groupNames={[]}
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Exclude All (0)" })
    ).toBeDisabled();
  });

  it("excludes the given groups and reports the fresh results on success", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onExcluded = vi.fn();
    const results = baseResults();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(results), { status: 200 })
      )
    );

    render(
      <ExcludeAllButton
        sessionId="s1"
        groupNames={["10x10", "10x20"]}
        onUpdated={onUpdated}
        onExcluded={onExcluded}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Exclude All (2)" })
    );

    await waitFor(() => {
      expect(onExcluded).toHaveBeenCalledWith(["10x10", "10x20"]);
    });

    expect(onUpdated).toHaveBeenCalledWith(results);
  });

  it("shows a pending label while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch: (response: Response) => void = () => {};

    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    render(
      <ExcludeAllButton
        sessionId="s1"
        groupNames={["10x10"]}
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Exclude All (1)" })
    );

    const button = screen.getByRole("button", { name: "Excluding..." });
    expect(button).toBeDisabled();

    resolveFetch(new Response(JSON.stringify(baseResults()), { status: 200 }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Exclude All (1)" })
      ).not.toBeDisabled();
    });
  });

  it("treats a 404 as a session expiry, not a failure", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onSessionExpired = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    );

    render(
      <ExcludeAllButton
        sessionId="s1"
        groupNames={["10x10"]}
        onUpdated={onUpdated}
        onExcluded={vi.fn()}
        onSessionExpired={onSessionExpired}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Exclude All (1)" })
    );

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("shows the error message on a failed request", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "exclude failed" }), {
          status: 500,
        })
      )
    );

    render(
      <ExcludeAllButton
        sessionId="s1"
        groupNames={["10x10"]}
        onUpdated={onUpdated}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Exclude All (1)" })
    );

    expect(await screen.findByText("exclude failed")).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
