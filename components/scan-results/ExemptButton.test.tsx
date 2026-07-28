import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExemptButton } from "./ExemptButton";
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

describe("ExemptButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders its explanatory label", () => {
    render(
      <ExemptButton
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        onExempted={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Not a dimensioned unit (office, apartment, etc.)",
      })
    ).toBeInTheDocument();
  });

  it("exempts the unit and reports the fresh results on success", async () => {
    const user = userEvent.setup();
    const onExempted = vi.fn();
    const results = baseResults();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(results), { status: 200 })
      )
    );

    render(
      <ExemptButton
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        onExempted={onExempted}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Not a dimensioned unit (office, apartment, etc.)",
      })
    );

    await waitFor(() => {
      expect(onExempted).toHaveBeenCalledWith(results);
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      session_id: "s1",
      file_name: "units.csv",
      unit_number: "101",
    });
  });

  it("shows a pending label and disables the button while saving", async () => {
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
      <ExemptButton
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        onExempted={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Not a dimensioned unit (office, apartment, etc.)",
      })
    );

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    resolveFetch(new Response(JSON.stringify(baseResults()), { status: 200 }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Not a dimensioned unit (office, apartment, etc.)",
        })
      ).not.toBeDisabled();
    });
  });

  it("treats a 401 as a session expiry", async () => {
    const user = userEvent.setup();
    const onExempted = vi.fn();
    const onSessionExpired = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    );

    render(
      <ExemptButton
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        onExempted={onExempted}
        onSessionExpired={onSessionExpired}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Not a dimensioned unit (office, apartment, etc.)",
      })
    );

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    expect(onExempted).not.toHaveBeenCalled();
  });

  it("shows the error message on a failed request", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "exempt failed" }), {
          status: 500,
        })
      )
    );

    render(
      <ExemptButton
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        onExempted={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Not a dimensioned unit (office, apartment, etc.)",
      })
    );

    expect(await screen.findByText("exempt failed")).toBeInTheDocument();
  });
});
