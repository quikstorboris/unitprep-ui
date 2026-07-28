import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupCorrectionCard } from "./GroupCorrectionCard";
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

describe("GroupCorrectionCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the group name without a count when none is given", () => {
    render(
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByText("10x10 Climate")).toBeInTheDocument();
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  it("renders the occurrence count when given", () => {
    render(
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        count={5}
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByText("(5)")).toBeInTheDocument();
  });

  it("saves the typed width/length/additional properties and shows a confirmation", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const results = baseResults();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(results), { status: 200 })
      )
    );

    render(
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        onUpdated={onUpdated}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    const [widthInput, lengthInput, additionalPropertiesInput] =
      screen.getAllByRole("textbox");
    await user.type(widthInput, "10");
    await user.type(lengthInput, "20");
    await user.type(additionalPropertiesInput, "Ground Floor");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(results);
    });

    expect(screen.getByText("✓ saved")).toBeInTheDocument();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      session_id: "s1",
      group_name: "10x10 Climate",
      width: "10",
      length: "20",
      additional_properties: "Ground Floor",
    });
  });

  it("sends null for blank width/length/additional properties", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(baseResults()), { status: 200 })
      )
    );

    render(
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({
      session_id: "s1",
      group_name: "10x10 Climate",
      width: null,
      length: null,
      additional_properties: null,
    });
  });

  it("excludes the group and reports the fresh results on success", async () => {
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
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        onUpdated={onUpdated}
        onExcluded={onExcluded}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Exclude this group" })
    );

    await waitFor(() => {
      expect(onExcluded).toHaveBeenCalledWith(["10x10 Climate"]);
    });

    expect(onUpdated).toHaveBeenCalledWith(results);
  });

  it("cross-disables Save and Exclude while either request is pending", async () => {
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
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Exclude this group" })
    ).toBeDisabled();

    resolveFetch(new Response(JSON.stringify(baseResults()), { status: 200 }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    });
  });

  it("treats a 404 as a session expiry, not a failure", async () => {
    const user = userEvent.setup();
    const onSessionExpired = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    );

    render(
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={onSessionExpired}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Exclude this group" })
    );

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the error message from a failed save", async () => {
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
      <GroupCorrectionCard
        sessionId="s1"
        groupName="10x10 Climate"
        onUpdated={vi.fn()}
        onExcluded={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });
});
