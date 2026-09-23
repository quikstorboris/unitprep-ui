import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ManuallyMaintainedNote,
  PolicySectionHeader,
  QsxEmptyBanner,
} from "./PolicyTabShared";

describe("PolicySectionHeader", () => {
  it("shows an Edit button in read mode and calls onEdit when clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <PolicySectionHeader
        title="Fees"
        editing={false}
        saving={false}
        onEdit={onEdit}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("shows Cancel/Save in edit mode, calling the right handler for each", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSave = vi.fn();

    render(
      <PolicySectionHeader
        title="Fees"
        editing={true}
        saving={false}
        onEdit={vi.fn()}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both Cancel and Save, and relabels Save, while saving", () => {
    render(
      <PolicySectionHeader
        title="Fees"
        editing={true}
        saving={true}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});

describe("QsxEmptyBanner", () => {
  it("names the given category", () => {
    render(<QsxEmptyBanner category="delinquency" />);
    expect(screen.getByText(/no delinquency data/i)).toBeInTheDocument();
  });
});

describe("ManuallyMaintainedNote", () => {
  it("renders the permanent-exemption explanation", () => {
    render(<ManuallyMaintainedNote />);
    expect(screen.getByText(/manually maintained/i)).toBeInTheDocument();
  });
});
