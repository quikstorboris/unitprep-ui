import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UndoImportAsIsButton } from "./UndoImportAsIsButton";
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

describe("UndoImportAsIsButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the group count in its label", () => {
    render(
      <UndoImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["A", "B"]}
        onUpdated={vi.fn()}
        onUnacknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Undo Import As Is (2)" })
    ).toBeInTheDocument();
  });

  it("is disabled when there are no groups to restore", () => {
    render(
      <UndoImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={[]}
        onUpdated={vi.fn()}
        onUnacknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Undo Import As Is (0)" })
    ).toBeDisabled();
  });

  it("unacknowledges the given groups for this check and reports the fresh results", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onUnacknowledged = vi.fn();
    const results = baseResults();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(results), { status: 200 })
      )
    );

    render(
      <UndoImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={onUpdated}
        onUnacknowledged={onUnacknowledged}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Undo Import As Is (1)" })
    );

    await waitFor(() => {
      expect(onUnacknowledged).toHaveBeenCalledWith(["Hertz Office"]);
    });

    expect(onUpdated).toHaveBeenCalledWith(results);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      session_id: "s1",
      check: "Odd UnitGroup detected",
      group_names: ["Hertz Office"],
      acknowledged: false,
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
      <UndoImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={vi.fn()}
        onUnacknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Undo Import As Is (1)" })
    );

    expect(screen.getByRole("button", { name: "Restoring..." })).toBeDisabled();

    resolveFetch(new Response(JSON.stringify(baseResults()), { status: 200 }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Undo Import As Is (1)" })
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
      <UndoImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={onUpdated}
        onUnacknowledged={vi.fn()}
        onSessionExpired={onSessionExpired}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Undo Import As Is (1)" })
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
        new Response(JSON.stringify({ message: "undo failed" }), {
          status: 500,
        })
      )
    );

    render(
      <UndoImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={vi.fn()}
        onUnacknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Undo Import As Is (1)" })
    );

    expect(await screen.findByText("undo failed")).toBeInTheDocument();
  });
});
