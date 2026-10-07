import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClickUpParentChange, FacilitySummary } from "@/lib/clientsDetail";

const { setClickUpParent } = vi.hoisted(() => ({ setClickUpParent: vi.fn() }));

vi.mock("@/lib/clientsDetail", () => ({ setClickUpParent }));

import ClickUpParentPicker from "./ClickUpParentPicker";

function facility(id: string, name: string, linked: boolean): FacilitySummary {
  return {
    id,
    name,
    dropbox_folder_url: null,
    clickup_list_id: linked ? `L-${id}` : null,
    clickup_list_name: linked ? `${name} list` : null,
    clickup_folder_name: null,
    clickup_list_url: linked ? "https://app.clickup.com/1/v/li/1" : null,
  };
}

const facilities = [facility("f1", "Alpha", true), facility("f2", "Beta", true), facility("f3", "Gamma", false)];

function renderPicker(overrides: Partial<React.ComponentProps<typeof ClickUpParentPicker>> = {}) {
  const onChanged = vi.fn();
  render(
    <ClickUpParentPicker
      companyId="c1"
      facilities={facilities}
      parentFacilityId={null}
      history={[]}
      canEdit
      onChanged={onChanged}
      {...overrides}
    />
  );
  return { onChanged };
}

beforeEach(() => setClickUpParent.mockReset());

describe("ClickUpParentPicker", () => {
  it("offers only facilities that have a ClickUp list linked", () => {
    renderPicker();

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["None designated", "Alpha", "Beta"]);
  });

  it("designates the chosen facility and tells the page to refetch", async () => {
    setClickUpParent.mockResolvedValue({ kind: "ok", data: undefined });
    const { onChanged } = renderPicker();

    await userEvent.setup().selectOptions(screen.getByLabelText("Parent facility"), "f2");

    expect(setClickUpParent).toHaveBeenCalledWith("c1", "f2");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("clears the designation when 'None designated' is chosen", async () => {
    setClickUpParent.mockResolvedValue({ kind: "ok", data: undefined });
    renderPicker({ parentFacilityId: "f1" });

    await userEvent.setup().selectOptions(screen.getByLabelText("Parent facility"), "");

    expect(setClickUpParent).toHaveBeenCalledWith("c1", null);
  });

  it("shows the server's message and does not refetch when the change is refused", async () => {
    setClickUpParent.mockResolvedValue({ kind: "error", message: "Alpha has no ClickUp list linked yet." });
    const { onChanged } = renderPicker();

    await userEvent.setup().selectOptions(screen.getByLabelText("Parent facility"), "f1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Alpha has no ClickUp list linked yet.");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("is read-only for a user who cannot edit the company", () => {
    renderPicker({ canEdit: false });

    expect(screen.getByLabelText("Parent facility")).toBeDisabled();
  });

  it("warns when the designated parent has lost its ClickUp list", () => {
    renderPicker({ parentFacilityId: "f3" });

    expect(screen.getByRole("alert")).toHaveTextContent("Gamma no longer has a ClickUp list linked");
  });

  it("lists every past designation, oldest first, with who made it", () => {
    const history: ClickUpParentChange[] = [
      {
        from_facility_id: null,
        from_facility_name: null,
        to_facility_id: "f1",
        to_facility_name: "Alpha",
        changed_by_name: "Boris M",
        changed_at: "2026-10-07T10:00:00Z",
      },
      {
        from_facility_id: "f1",
        from_facility_name: "Alpha",
        to_facility_id: "f2",
        to_facility_name: "Beta",
        changed_by_name: null,
        changed_at: "2026-10-08T10:00:00Z",
      },
    ];
    renderPicker({ history, parentFacilityId: "f2" });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Alpha");
    expect(items[0]).toHaveTextContent("Boris M");
    expect(items[1]).toHaveTextContent("Beta (was Alpha)");
  });
});
