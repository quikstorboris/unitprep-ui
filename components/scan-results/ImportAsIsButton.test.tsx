import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportAsIsButton } from "./ImportAsIsButton";
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

describe("ImportAsIsButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the group count in its label", () => {
    render(
      <ImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["A", "B"]}
        onUpdated={vi.fn()}
        onAcknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Import as is (2)" })
    ).toBeInTheDocument();
  });

  it("is disabled when there are no groups to import", () => {
    render(
      <ImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={[]}
        onUpdated={vi.fn()}
        onAcknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Import as is (0)" })
    ).toBeDisabled();
  });

  it("acknowledges the given groups for this check and reports the fresh results", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onAcknowledged = vi.fn();
    const results = baseResults();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(results), { status: 200 })
      )
    );

    render(
      <ImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={onUpdated}
        onAcknowledged={onAcknowledged}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Import as is (1)" })
    );

    await waitFor(() => {
      expect(onAcknowledged).toHaveBeenCalledWith(["Hertz Office"]);
    });

    expect(onUpdated).toHaveBeenCalledWith(results);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      session_id: "s1",
      check: "Odd UnitGroup detected",
      group_names: ["Hertz Office"],
      acknowledged: true,
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
      <ImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={vi.fn()}
        onAcknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Import as is (1)" })
    );

    expect(screen.getByRole("button", { name: "Importing..." })).toBeDisabled();

    resolveFetch(new Response(JSON.stringify(baseResults()), { status: 200 }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Import as is (1)" })
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
      <ImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={onUpdated}
        onAcknowledged={vi.fn()}
        onSessionExpired={onSessionExpired}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Import as is (1)" })
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
        new Response(JSON.stringify({ message: "import failed" }), {
          status: 500,
        })
      )
    );

    render(
      <ImportAsIsButton
        sessionId="s1"
        check="Odd UnitGroup detected"
        groupNames={["Hertz Office"]}
        onUpdated={vi.fn()}
        onAcknowledged={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Import as is (1)" })
    );

    expect(await screen.findByText("import failed")).toBeInTheDocument();
  });
});
