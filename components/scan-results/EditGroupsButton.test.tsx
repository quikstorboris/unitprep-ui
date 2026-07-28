import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditGroupsButton } from "./EditGroupsButton";
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

describe("EditGroupsButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the group count in its label", () => {
    render(
      <EditGroupsButton
        sessionId="s1"
        groupNames={["A", "B"]}
        onUpdated={vi.fn()}
        onIncluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Edit Groups (2)" })
    ).toBeInTheDocument();
  });

  it("is disabled when there are no excluded groups to restore", () => {
    render(
      <EditGroupsButton
        sessionId="s1"
        groupNames={[]}
        onUpdated={vi.fn()}
        onIncluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Edit Groups (0)" })
    ).toBeDisabled();
  });

  it("re-includes the given groups and reports the fresh results on success", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onIncluded = vi.fn();
    const results = baseResults();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(results), { status: 200 })
      )
    );

    render(
      <EditGroupsButton
        sessionId="s1"
        groupNames={["10x10"]}
        onUpdated={onUpdated}
        onIncluded={onIncluded}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Edit Groups (1)" })
    );

    await waitFor(() => {
      expect(onIncluded).toHaveBeenCalledWith(["10x10"]);
    });

    expect(onUpdated).toHaveBeenCalledWith(results);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      session_id: "s1",
      group_names: ["10x10"],
      excluded: false,
    });
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
      <EditGroupsButton
        sessionId="s1"
        groupNames={["10x10"]}
        onUpdated={vi.fn()}
        onIncluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Edit Groups (1)" })
    );

    expect(screen.getByRole("button", { name: "Restoring..." })).toBeDisabled();

    resolveFetch(new Response(JSON.stringify(baseResults()), { status: 200 }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Edit Groups (1)" })
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
      <EditGroupsButton
        sessionId="s1"
        groupNames={["10x10"]}
        onUpdated={onUpdated}
        onIncluded={vi.fn()}
        onSessionExpired={onSessionExpired}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Edit Groups (1)" })
    );

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("shows the error message on a failed request", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "edit failed" }), {
          status: 500,
        })
      )
    );

    render(
      <EditGroupsButton
        sessionId="s1"
        groupNames={["10x10"]}
        onUpdated={vi.fn()}
        onIncluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Edit Groups (1)" })
    );

    expect(await screen.findByText("edit failed")).toBeInTheDocument();
  });
});
