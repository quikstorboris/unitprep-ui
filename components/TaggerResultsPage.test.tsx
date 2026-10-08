import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateView } from "@/types/api";

const m = vi.hoisted(() => ({
  report: vi.fn(),
  apply: vi.fn(),
  save: vi.fn(),
  saveLocation: vi.fn(),
  listQmsTags: vi.fn(),
  handleApply: vi.fn(),
  handleSave: vi.fn(),
  cancelReport: vi.fn(),
  cancelApply: vi.fn(),
}));

vi.mock("./tagger/useTaggerReport", () => ({ useTaggerReport: m.report }));
vi.mock("./tagger/useTaggerApply", () => ({ useTaggerApply: m.apply }));
vi.mock("./tagger/useTaggerSaveToDropbox", () => ({ useTaggerSaveToDropbox: m.save }));
vi.mock("./tagger/useTaggerSaveLocation", () => ({ useTaggerSaveLocation: m.saveLocation }));
vi.mock("@/lib/clientOps", () => ({ listQmsTags: m.listQmsTags }));
vi.mock("./SessionExpiredPage", () => ({ default: () => <div>session expired</div> }));
vi.mock("./tagger/CandidateRow", () => ({
  default: (props: {
    candidate: CandidateView;
    checked: boolean;
    selectedTagKey: string;
    onToggle: (checked: boolean) => void;
    onTagChange: (tagKey: string) => void;
  }) => (
    <div>
      <label>
        <input
          type="checkbox"
          aria-label={`candidate ${props.candidate.index}`}
          checked={props.checked}
          onChange={(e) => props.onToggle(e.target.checked)}
        />
        {props.candidate.matched_text} [{props.selectedTagKey}]
      </label>
      <button type="button" onClick={() => props.onTagChange("other_tag")}>
        retag {props.candidate.index}
      </button>
    </div>
  ),
}));
vi.mock("./tagger/PreserveUnderscoresDialog", () => ({
  default: (props: { onChoose: (preserve: boolean) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => props.onChoose(true)}>preserve</button>
      <button onClick={() => props.onChoose(false)}>do not preserve</button>
      <button onClick={props.onCancel}>dialog cancel</button>
    </div>
  ),
}));

import TaggerResultsPage from "./TaggerResultsPage";

function candidate(index: number, tier: "auto" | "review", matched = `text${index}`): CandidateView {
  return { index, tier, tag_key: `tag${index}`, matched_text: matched } as unknown as CandidateView;
}

function setup({
  candidates = [candidate(0, "auto"), candidate(1, "review")] as CandidateView[] | undefined,
  report = {},
  apply = {},
  save = {},
  defaultFolderPath = undefined as string | undefined,
} = {}) {
  m.report.mockReturnValue({
    candidates,
    loading: false,
    error: null,
    sessionExpired: false,
    cancelled: false,
    elapsedMs: 0,
    cancel: m.cancelReport,
    ...report,
  });
  m.apply.mockReturnValue({
    applying: false,
    downloadComplete: false,
    error: null,
    sessionExpired: false,
    cancelled: false,
    elapsedMs: 0,
    cancelApply: m.cancelApply,
    handleApply: m.handleApply,
    ...apply,
  });
  m.save.mockReturnValue({
    saving: false,
    savedPath: null,
    error: null,
    sessionExpired: false,
    handleSave: m.handleSave,
    ...save,
  });
  m.saveLocation.mockReturnValue({ defaultFolderPath });
  const onHome = vi.fn();
  render(<TaggerResultsPage sessionId="s1" onHome={onHome} />);
  return { onHome };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.listQmsTags.mockResolvedValue({ kind: "ok", data: { tags: [] } });
});

describe("TaggerResultsPage", () => {
  it("shows the recognizing state with a working Cancel", async () => {
    setup({ report: { loading: true, candidates: undefined, elapsedMs: 5000 } });
    expect(screen.getByText(/Recognizing tags in this document/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(m.cancelReport).toHaveBeenCalled();
  });

  it("shows a cancelled report and a report error, each with Home", async () => {
    const { onHome } = setup({ report: { cancelled: true, candidates: undefined } });
    expect(screen.getByText("Tag recognition cancelled.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).toHaveBeenCalled();
  });

  it("shows the report error", () => {
    setup({ report: { error: "recognition failed", candidates: undefined } });
    expect(screen.getByText("recognition failed")).toBeInTheDocument();
  });

  it("renders the expired page when any of the three operations expired", () => {
    setup({ save: { sessionExpired: true } });
    expect(screen.getByText("session expired")).toBeInTheDocument();
  });

  it("starts auto candidates checked and review candidates unchecked, in two sections", () => {
    setup();
    expect(screen.getByText("Auto-Apply (1)")).toBeInTheDocument();
    expect(screen.getByText("Needs Review (1)")).toBeInTheDocument();
    expect(screen.getByLabelText("candidate 0")).toBeChecked();
    expect(screen.getByLabelText("candidate 1")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Apply 1 Substitution" })).toBeEnabled();
  });

  it("applies only the checked candidates, with edited tag keys, and no dialog when nothing is blank", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("candidate 1"));
    await userEvent.click(screen.getByRole("button", { name: "retag 1" }));
    expect(screen.getByRole("button", { name: "Apply 2 Substitutions" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Apply 2 Substitutions" }));

    expect(m.handleApply).toHaveBeenCalledWith(
      [
        { candidate_index: 0, tag_key: "tag0" },
        { candidate_index: 1, tag_key: "other_tag" },
      ],
      false
    );
  });

  it("disables Apply when nothing is checked", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("candidate 0"));
    expect(screen.getByRole("button", { name: "Apply 0 Substitutions" })).toBeDisabled();
  });

  it("asks about preserving blanks before applying, and passes the answer through", async () => {
    setup({ candidates: [candidate(0, "auto", "________")] });
    await userEvent.click(screen.getByRole("button", { name: /^Apply/ }));
    expect(m.handleApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "preserve" }));
    expect(m.handleApply).toHaveBeenCalledWith([{ candidate_index: 0, tag_key: "tag0" }], true);
    expect(screen.queryByRole("button", { name: "preserve" })).not.toBeInTheDocument();
  });

  it("cancelling the dialog runs nothing", async () => {
    setup({ candidates: [candidate(0, "auto", "___")] });
    await userEvent.click(screen.getByRole("button", { name: /^Apply/ }));
    await userEvent.click(screen.getByRole("button", { name: "dialog cancel" }));
    expect(m.handleApply).not.toHaveBeenCalled();
    expect(m.handleSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "preserve" })).not.toBeInTheDocument();
  });

  it("saves to the facility folder (through the blanks dialog) with the folder path", async () => {
    setup({ candidates: [candidate(0, "auto", "___")], defaultFolderPath: "/QMS/Acme" });
    await userEvent.click(screen.getByRole("button", { name: "Save to Facility Folder" }));
    await userEvent.click(screen.getByRole("button", { name: "do not preserve" }));
    expect(m.handleSave).toHaveBeenCalledWith([{ candidate_index: 0, tag_key: "tag0" }], false, "/QMS/Acme");
    expect(m.handleApply).not.toHaveBeenCalled();
  });

  it("saves directly when nothing is blank; no save button without a default folder", async () => {
    setup({ defaultFolderPath: "/QMS/Acme" });
    await userEvent.click(screen.getByRole("button", { name: "Save to Facility Folder" }));
    expect(m.handleSave).toHaveBeenCalledWith([{ candidate_index: 0, tag_key: "tag0" }], false, "/QMS/Acme");
  });

  it("hides the save button when there is no default folder", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Save to Facility Folder" })).not.toBeInTheDocument();
  });

  it("shows the destination link once saved, and the downloaded state with Home", async () => {
    const { onHome } = setup({
      apply: { downloadComplete: true },
      save: { savedPath: "/QMS/Acme/doc.docx" },
    });
    expect(screen.getByText("Tagged Document Downloaded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Destination Folder/ })).toHaveAttribute(
      "href",
      expect.stringContaining("Acme")
    );
    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).toHaveBeenCalled();
  });

  it("shows apply progress with Cancel, apply/save errors, and the cancelled note", async () => {
    setup({
      apply: { applying: true, elapsedMs: 3000, error: "apply failed" },
      save: { error: "save failed" },
    });
    expect(screen.getByText("apply failed")).toBeInTheDocument();
    expect(screen.getByText("save failed")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    expect(m.cancelApply).toHaveBeenCalled();
  });

  it("shows 'Apply cancelled.' when an apply was cancelled", () => {
    setup({ apply: { cancelled: true } });
    expect(screen.getByText("Apply cancelled.")).toBeInTheDocument();
  });

  it("shows the empty-candidates message and no actions", () => {
    setup({ candidates: [] });
    expect(screen.getByText(/No candidates found/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeInTheDocument();
  });

  it("surfaces a tag-catalog load failure", async () => {
    m.listQmsTags.mockResolvedValue({ kind: "error", message: "catalog down" });
    setup();
    await waitFor(() => expect(screen.getByText(/catalog down/)).toBeInTheDocument());
  });

  it("lets a needs-review candidate be checked", async () => {
    setup();
    await userEvent.click(screen.getByLabelText("candidate 1"));
    expect(screen.getByLabelText("candidate 1")).toBeChecked();
  });
});
