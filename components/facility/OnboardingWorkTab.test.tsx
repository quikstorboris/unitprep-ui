import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnboardingWorkTab } from "./OnboardingWorkTab";
import { RunCard } from "./RunCard";
import type { ToolRunSummary } from "@/types/api";

// The feed is covered by its own hook's tests; here it is only a marker of
// which activity is open.
vi.mock("@/components/facility/ToolRunFeed", () => ({
  ToolRunFeed: ({ tool }: { tool: string }) => <div data-testid="feed">{tool}</div>,
}));

vi.mock("@/lib/currentUser", () => ({
  useCurrentUser: () => ({ user: { permissions: ["client_ops.perform"] } }),
}));

vi.mock("@/lib/auth-session", () => ({
  hasPermission: () => true,
}));

const base = {
  id: "run-1",
  sequence_number: 2,
  actor_user_id: "u1",
  actor_first_name: "Boris",
  actor_last_name: "M",
  actor_email: "b@x.com",
  source_file_name: "Custom Unit Report.xlsx",
  source_dropbox_path: null,
  has_source_file: false,
  can_rematch: false,
  output_kind: "none" as const,
  output_dropbox_path: null,
  created_at: "2026-10-02T12:00:00Z",
  completed_at: null,
};

describe("OnboardingWorkTab", () => {
  it("opens on Duplicate Check and switches to each activity's own feed", () => {
    render(<OnboardingWorkTab companyId="c1" facilityId="f1" />);

    expect(screen.getByRole("tab", { name: "Duplicate Check" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("feed")).toHaveTextContent("dedup");

    fireEvent.click(screen.getByRole("tab", { name: "Unit Groups" }));
    expect(screen.getByRole("tab", { name: "Unit Groups" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("feed")).toHaveTextContent("unit_group");

    fireEvent.click(screen.getByRole("tab", { name: "Template Tagger" }));
    expect(screen.getByTestId("feed")).toHaveTextContent("tagger");
  });
});

describe("RunCard", () => {
  it("shows a Unit Groups run's files and analysis when expanded", () => {
    const run: ToolRunSummary = {
      ...base,
      tool: "unit_group",
      report_summary: {
        facilities: 1,
        global_groups: 20,
        net_new_groups: 2,
        similar_groups: 0,
        advisory_issues: 0,
        net_new_group_details: ["Self Storage 10x20", "Parking 10x40"],
        similar_group_details: [],
        advisory_issue_details: [],
        unit_files: ["Custom Unit Report.xlsx"],
        group_file: null,
      },
    };

    render(<RunCard companyId="c1" facilityId="f1" run={run} onDeleted={() => {}} />);

    expect(screen.getByText("2nd Unit Group Run")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /2nd Unit Group Run/ }));

    expect(screen.getByText(/Unit files:/)).toBeInTheDocument();
    expect(screen.getByText("Self Storage 10x20")).toBeInTheDocument();
    expect(screen.getByText(/none \(every group counts as new\)/)).toBeInTheDocument();
  });

  it("shows a Tagger run's template, counts and the not-yet-applied state", () => {
    const run: ToolRunSummary = {
      ...base,
      tool: "tagger",
      source_file_name: "Late Notice.docx",
      report_summary: {
        template_file: "Late Notice.docx",
        candidate_count: 7,
        needs_review_count: 2,
        tags: { tenant_name: 4, unit_number: 3 },
        applied_count: null,
      },
    };

    render(<RunCard companyId="c1" facilityId="f1" run={run} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Template Tagging/ }));

    expect(screen.getByText("Places found")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Not applied")).toBeInTheDocument();
  });

  it("shows how many tags a Tagger run applied", () => {
    const run: ToolRunSummary = {
      ...base,
      tool: "tagger",
      report_summary: {
        template_file: "Late Notice.docx",
        candidate_count: 7,
        needs_review_count: 2,
        tags: { tenant_name: 7 },
        applied_count: 5,
        preserve_blanks: true,
      },
    };

    render(<RunCard companyId="c1" facilityId="f1" run={run} onDeleted={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Template Tagging/ }));

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/keeping the blank's underline/)).toBeInTheDocument();
  });
});
