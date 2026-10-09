import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolRunSummary } from "@/types/api";

const { useClickUpAccess } = vi.hoisted(() => ({ useClickUpAccess: vi.fn() }));

vi.mock("@/components/clickup/useClickUpAccess", () => ({ useClickUpAccess }));

// The panel is covered by its own tests; here it only shows what it was given.
vi.mock("@/components/clickup/ClickUpRunUpdatePanel", () => ({
  default: ({
    sessionId,
    fileSavedToDropbox,
    onDismiss,
  }: {
    sessionId: string;
    fileSavedToDropbox: boolean;
    onDismiss?: () => void;
  }) => (
    <section aria-label="Update ClickUp panel">
      <span data-testid="panel-args">
        {sessionId}|{String(fileSavedToDropbox)}
      </span>
      <button type="button" onClick={onDismiss}>
        Not now
      </button>
    </section>
  ),
}));

vi.mock("@/components/facility/DedupRunDetails", () => ({ DedupRunDetails: () => <div /> }));

vi.mock("@/lib/currentUser", () => ({
  useCurrentUser: () => ({ user: { permissions: ["client_ops.perform"] } }),
}));
vi.mock("@/lib/auth-session", () => ({ hasPermission: () => true }));

import { RunCard } from "./RunCard";

const base = {
  id: "run-row-id",
  sequence_number: 1,
  actor_user_id: "u1",
  actor_first_name: "Boris",
  actor_last_name: "M",
  actor_email: "b@x.com",
  source_file_name: "Tenants.csv",
  source_dropbox_path: null,
  has_source_file: false,
  can_rematch: false,
  output_kind: "none" as const,
  output_dropbox_path: null,
  created_at: "2026-10-02T12:00:00Z",
  completed_at: null,
};

const dedupRun = (overrides: Partial<ToolRunSummary> = {}) =>
  ({
    ...base,
    tool: "dedup",
    report_summary: {},
    ...overrides,
  }) as ToolRunSummary;

function renderExpanded(run: ToolRunSummary) {
  render(<RunCard companyId="c1" facilityId="f1" run={run} onDeleted={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Duplicate Check|Unit Group Run|Template Tagging/ }));
}

beforeEach(() => {
  useClickUpAccess.mockReturnValue({ allowed: true });
});

describe("Update ClickUp on a run", () => {
  it("offers the button on a duplicate check and opens the panel for that run", () => {
    renderExpanded(dedupRun());

    expect(screen.queryByLabelText("Update ClickUp panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update ClickUp" }));

    expect(screen.getByLabelText("Update ClickUp panel")).toBeInTheDocument();
    // The run's row id is what names it; no file was saved to Dropbox.
    expect(screen.getByTestId("panel-args")).toHaveTextContent("run-row-id|false");
  });

  it("tells the panel when the results file was saved to Dropbox, so the comment can link it", () => {
    renderExpanded(
      dedupRun({ output_kind: "dropbox", output_dropbox_path: "/QMS Onboarding/A/b.xlsx" } as Partial<ToolRunSummary>)
    );

    fireEvent.click(screen.getByRole("button", { name: "Update ClickUp" }));

    expect(screen.getByTestId("panel-args")).toHaveTextContent("run-row-id|true");
  });

  it("toggles the panel closed from the button, and reopens it", () => {
    renderExpanded(dedupRun());
    const button = screen.getByRole("button", { name: "Update ClickUp" });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(screen.queryByLabelText("Update ClickUp panel")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByLabelText("Update ClickUp panel")).toBeInTheDocument();
  });

  it("closes when the person chooses Not now, and can be opened again", () => {
    renderExpanded(dedupRun());
    fireEvent.click(screen.getByRole("button", { name: "Update ClickUp" }));

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByLabelText("Update ClickUp panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update ClickUp" }));
    expect(screen.getByLabelText("Update ClickUp panel")).toBeInTheDocument();
  });

  it("is hidden for a user without ClickUp access", () => {
    useClickUpAccess.mockReturnValue({ allowed: false });
    renderExpanded(dedupRun());

    expect(screen.queryByRole("button", { name: "Update ClickUp" })).not.toBeInTheDocument();
  });

  it("is offered on Unit Groups and Template Tagger runs too", () => {
    const unitGroup = {
      ...base,
      tool: "unit_group",
      report_summary: {
        facilities: 1,
        global_groups: 1,
        net_new_groups: 0,
        similar_groups: 0,
        advisory_issues: 0,
        net_new_group_details: [],
        similar_group_details: [],
        advisory_issue_details: [],
        unit_files: [],
        group_file: null,
      },
    } as ToolRunSummary;
    renderExpanded(unitGroup);

    fireEvent.click(screen.getByRole("button", { name: "Update ClickUp" }));
    expect(screen.getByLabelText("Update ClickUp panel")).toBeInTheDocument();
  });
});
