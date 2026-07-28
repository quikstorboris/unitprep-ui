import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CorrectionField } from "./CorrectionField";
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

describe("CorrectionField", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the field name as its label", () => {
    render(
      <CorrectionField
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        field="Width"
        onSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByText("Width")).toBeInTheDocument();
  });

  it("keeps Save disabled until a value is typed", async () => {
    const user = userEvent.setup();

    render(
      <CorrectionField
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        field="Width"
        onSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText("corrected value"),
      "10"
    );

    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("saves the typed value and shows a confirmation on success", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const results = baseResults();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(results), { status: 200 })
      )
    );

    render(
      <CorrectionField
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        field="Width"
        onSaved={onSaved}
        onSessionExpired={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("corrected value"),
      "10"
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(results);
    });

    expect(screen.getByText("✓ saved")).toBeInTheDocument();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      session_id: "s1",
      file_name: "units.csv",
      unit_number: "101",
      field: "Width",
      value: "10",
    });
  });

  it("clears the confirmation once the value is edited again", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(baseResults()), { status: 200 })
      )
    );

    render(
      <CorrectionField
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        field="Width"
        onSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("corrected value");
    await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("✓ saved")).toBeInTheDocument();
    });

    await user.type(input, "5");

    expect(screen.queryByText("✓ saved")).not.toBeInTheDocument();
  });

  it("shows a pending label and disables the field while saving", async () => {
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
      <CorrectionField
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        field="Width"
        onSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("corrected value"),
      "10"
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByPlaceholderText("corrected value")).toBeDisabled();

    resolveFetch(new Response(JSON.stringify(baseResults()), { status: 200 }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    });
  });

  it("treats a 404 as a session expiry, not a failure", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onSessionExpired = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    );

    render(
      <CorrectionField
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        field="Width"
        onSaved={onSaved}
        onSessionExpired={onSessionExpired}
      />
    );

    await user.type(
      screen.getByPlaceholderText("corrected value"),
      "10"
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows the error message on a failed request", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "save failed" }), {
          status: 500,
        })
      )
    );

    render(
      <CorrectionField
        sessionId="s1"
        fileName="units.csv"
        unitNumber="101"
        field="Width"
        onSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("corrected value"),
      "10"
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });
});
