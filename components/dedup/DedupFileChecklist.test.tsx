import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DedupFileChecklist } from "./DedupFileChecklist";
import { folderResponse } from "./dedupTestData";

function renderChecklist(checked: string[] = ["Directory.xlsx"]) {
  const handlers = { onToggle: vi.fn(), onSelectAll: vi.fn(), onSelectNone: vi.fn() };
  render(
    <DedupFileChecklist
      classification={folderResponse()}
      checked={new Set(checked)}
      disabled={false}
      {...handlers}
    />
  );
  return handlers;
}

describe("DedupFileChecklist", () => {
  it("renders one labelled checkbox per file, ticked per the checked set", () => {
    renderChecklist();

    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getByRole("checkbox", { name: "Directory.xlsx" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Directory.csv" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "notes.csv" })).not.toBeChecked();
  });

  it("shows format badges, the not-a-dedup-file badge and the supporting badge", () => {
    renderChecklist();

    expect(screen.getAllByText("SiteLink Directory")).toHaveLength(2);
    expect(screen.getByText("Not a dedup file")).toBeInTheDocument();
    expect(screen.getByText("Could not be read")).toBeInTheDocument();
    expect(screen.getByText("Supporting file – not used yet")).toBeInTheDocument();
  });

  it("notes which file an alternative loses to", () => {
    renderChecklist();

    expect(screen.getByText("Alternative to Directory.xlsx")).toBeInTheDocument();
    expect(screen.getAllByText(/Alternative to/)).toHaveLength(1);
  });

  it("lets an unrecognized file be ticked manually", () => {
    const { onToggle } = renderChecklist();

    fireEvent.click(screen.getByRole("checkbox", { name: "notes.csv" }));
    expect(onToggle).toHaveBeenCalledWith("notes.csv");
  });

  it("wires Select all and Select none", () => {
    const { onSelectAll, onSelectNone } = renderChecklist();

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Select none" }));

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onSelectNone).toHaveBeenCalledTimes(1);
  });
});
