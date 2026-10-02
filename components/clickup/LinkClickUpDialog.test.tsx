import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClickUpListOption, FacilityClickUpSuggestion } from "@/lib/clickupLinks";

const { getClickUpSuggestions, listClickUpLists, resolveClickUpUrl, saveClickUpLinks } = vi.hoisted(() => ({
  getClickUpSuggestions: vi.fn(),
  listClickUpLists: vi.fn(),
  resolveClickUpUrl: vi.fn(),
  saveClickUpLinks: vi.fn(),
}));

vi.mock("@/lib/clickupLinks", () => ({
  getClickUpSuggestions,
  listClickUpLists,
  resolveClickUpUrl,
  saveClickUpLinks,
}));

import LinkClickUpDialog from "./LinkClickUpDialog";

function list(id: string, name: string, folder = "Affordable Storage - Beau Ryan"): ClickUpListOption {
  return { list_id: id, list_name: name, folder_id: `f-${folder}`, folder_name: folder, url: `https://app.clickup.com/1/v/li/${id}` };
}

const SYNOTT = list("100", "Affordable Storage Synott");
const COPPERFIELD = list("200", "Affordable Storage Copperfield");
const OTHER = list("300", "Elsewhere Storage", "Elsewhere Inc");

function facility(
  id: string,
  name: string,
  overrides: Partial<FacilityClickUpSuggestion> = {}
): FacilityClickUpSuggestion {
  return { facility_id: id, facility_name: name, current: null, suggestion: null, ...overrides };
}

function high(l: ClickUpListOption) {
  return { list: l, score: 1.0, confidence: "high" as const };
}
function low(l: ClickUpListOption) {
  return { list: l, score: 0.5, confidence: "low" as const };
}

function renderDialog(
  facilities: FacilityClickUpSuggestion[],
  props: Partial<React.ComponentProps<typeof LinkClickUpDialog>> = {}
) {
  getClickUpSuggestions.mockResolvedValue({ kind: "ok", data: { facilities } });
  listClickUpLists.mockResolvedValue({ kind: "ok", data: { lists: [COPPERFIELD, SYNOTT, OTHER] } });

  const handlers = { onClose: vi.fn(), onSaved: vi.fn() };
  render(
    <LinkClickUpDialog companyId="c1" companyName="Affordable Storage" {...handlers} {...props} />
  );
  return handlers;
}

const selectFor = (name: string) =>
  screen.findByRole("combobox", { name: `ClickUp list for ${name}` });

describe("LinkClickUpDialog", () => {
  beforeEach(() => {
    for (const fn of [getClickUpSuggestions, listClickUpLists, resolveClickUpUrl, saveClickUpLinks]) {
      fn.mockReset();
    }
  });

  it("preselects and ticks a strong suggestion, and the save button says how many it will link", async () => {
    renderDialog([facility("f1", "Affordable Storage Synott", { suggestion: high(SYNOTT) })]);

    expect(await selectFor("Affordable Storage Synott")).toHaveValue("100");
    expect(screen.getByRole("checkbox", { name: "Link Affordable Storage Synott" })).toBeChecked();
    expect(screen.getByText("Strong match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link 1 facility" })).toBeEnabled();
  });

  it("preselects but does NOT tick a weak suggestion, so nothing shaky is saved by default", async () => {
    renderDialog([facility("f1", "Dubuqueland Upper Lot", { suggestion: low(SYNOTT) })]);

    expect(await selectFor("Dubuqueland Upper Lot")).toHaveValue("100");
    expect(screen.getByRole("checkbox", { name: "Link Dubuqueland Upper Lot" })).not.toBeChecked();
    expect(screen.getByText(/Weak match/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nothing to link" })).toBeDisabled();
  });

  it("leaves a facility with no match empty, and says so", async () => {
    renderDialog([facility("f1", "Mystery Storage")]);

    expect(await selectFor("Mystery Storage")).toHaveValue("");
    expect(screen.getByText("No match found")).toBeInTheDocument();
  });

  it("shows an already-linked facility as Linked with nothing to save", async () => {
    renderDialog([
      facility("f1", "Affordable Storage Synott", {
        current: { list_id: "100", list_name: "Affordable Storage Synott", folder_name: null, url: "u" },
        suggestion: high(SYNOTT),
      }),
    ]);

    expect(await selectFor("Affordable Storage Synott")).toHaveValue("100");
    expect(screen.getByText("Linked")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Link Affordable Storage Synott" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nothing to link" })).toBeDisabled();
  });

  it("changing a row's list from the dropdown ticks it", async () => {
    const user = userEvent.setup();
    renderDialog([facility("f1", "Mystery Storage")]);

    await user.selectOptions(await selectFor("Mystery Storage"), "300");

    expect(screen.getByRole("checkbox", { name: "Link Mystery Storage" })).toBeChecked();
    expect(screen.getByText("Chosen by you")).toBeInTheDocument();
  });

  it("groups the dropdown by ClickUp folder", async () => {
    renderDialog([facility("f1", "Mystery Storage")]);

    const select = await selectFor("Mystery Storage");
    const groups = within(select).getAllByRole("group").map((g) => g.getAttribute("label"));

    expect(groups).toEqual(["Affordable Storage - Beau Ryan", "Elsewhere Inc"]);
  });

  it("saves only the ticked rows that are real changes, then reports success", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog([
      facility("f1", "Affordable Storage Synott", { suggestion: high(SYNOTT) }),
      facility("f2", "Affordable Storage Copperfield", { suggestion: low(COPPERFIELD) }),
      facility("f3", "Mystery Storage"),
    ]);
    saveClickUpLinks.mockResolvedValue({ kind: "ok", data: { linked: 1, shared_lists: [] } });

    await user.click(await screen.findByRole("button", { name: "Link 1 facility" }));

    expect(saveClickUpLinks).toHaveBeenCalledWith("c1", [{ facility_id: "f1", list_id: "100" }]);
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled());
  });

  it("warns when two rows pick the same list, but still allows it", async () => {
    const user = userEvent.setup();
    renderDialog([
      facility("f1", "Affordable Storage Synott", { suggestion: high(SYNOTT) }),
      facility("f2", "Mystery Storage"),
    ]);

    await user.selectOptions(await selectFor("Mystery Storage"), "100");

    expect(screen.getAllByText(/uses this list too/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Link 2 facilities" })).toBeEnabled();
  });

  it("shows the server's error and keeps the dialog open when saving fails", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog([facility("f1", "Affordable Storage Synott", { suggestion: high(SYNOTT) })]);
    saveClickUpLinks.mockResolvedValue({ kind: "error", message: "ClickUp rejected your saved token." });

    await user.click(await screen.findByRole("button", { name: "Link 1 facility" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ClickUp rejected your saved token.");
    expect(handlers.onSaved).not.toHaveBeenCalled();
  });

  it("after saving a list another facility already uses, shows a warning instead of closing silently", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog([facility("f1", "Affordable Storage Synott", { suggestion: high(SYNOTT) })]);
    saveClickUpLinks.mockResolvedValue({
      kind: "ok",
      data: {
        linked: 1,
        shared_lists: [{ list_id: "100", list_name: "Affordable Storage Synott", also_linked_to: ["Other Facility"] }],
      },
    });

    await user.click(await screen.findByRole("button", { name: "Link 1 facility" }));

    expect(await screen.findByText(/also linked to Other Facility/)).toBeInTheDocument();
    expect(screen.getByText(/Linked 1 facility/)).toBeInTheDocument();
    await waitFor(() => expect(handlers.onSaved).toHaveBeenCalled());
  });

  describe("Link manually", () => {
    it("explains where to get the URL in a tooltip next to the button", async () => {
      renderDialog([facility("f1", "Mystery Storage")]);
      await selectFor("Mystery Storage");

      expect(screen.getByRole("button", { name: "How to link manually" })).toHaveAttribute(
        "title",
        expect.stringContaining("address bar")
      );
    });

    it("resolves a pasted URL, shows nothing saved yet, and selects the list it points at", async () => {
      const user = userEvent.setup();
      renderDialog([facility("f1", "Mystery Storage")]);
      resolveClickUpUrl.mockResolvedValue({ kind: "ok", data: list("999", "Brand New List", "Mystery Folder") });

      await selectFor("Mystery Storage");
      await user.click(screen.getByRole("button", { name: "Link Mystery Storage manually" }));
      await user.type(
        screen.getByLabelText("ClickUp URL for Mystery Storage"),
        "https://app.clickup.com/1/v/li/999"
      );
      await user.click(screen.getByRole("button", { name: "Look up" }));

      expect(resolveClickUpUrl).toHaveBeenCalledWith("https://app.clickup.com/1/v/li/999");
      await waitFor(() => expect(screen.getByRole("combobox", { name: "ClickUp list for Mystery Storage" })).toHaveValue("999"));
      // The looked-up list is now selectable under its folder, ticked, and nothing was saved.
      expect(screen.getByRole("checkbox", { name: "Link Mystery Storage" })).toBeChecked();
      expect(saveClickUpLinks).not.toHaveBeenCalled();
    });

    it("shows why a pasted URL was refused and keeps what was typed", async () => {
      const user = userEvent.setup();
      renderDialog([facility("f1", "Mystery Storage")]);
      resolveClickUpUrl.mockResolvedValue({
        kind: "error",
        message: "That list is not in the QMS Onboarding space.",
      });

      await selectFor("Mystery Storage");
      await user.click(screen.getByRole("button", { name: "Link Mystery Storage manually" }));
      await user.type(screen.getByLabelText("ClickUp URL for Mystery Storage"), "https://app.clickup.com/1/v/li/7");
      await user.click(screen.getByRole("button", { name: "Look up" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("not in the QMS Onboarding space");
      expect(screen.getByLabelText("ClickUp URL for Mystery Storage")).toHaveValue(
        "https://app.clickup.com/1/v/li/7"
      );
    });

    it("keeps Look up disabled until something is pasted", async () => {
      const user = userEvent.setup();
      renderDialog([facility("f1", "Mystery Storage")]);

      await selectFor("Mystery Storage");
      await user.click(screen.getByRole("button", { name: "Link Mystery Storage manually" }));

      expect(screen.getByRole("button", { name: "Look up" })).toBeDisabled();
    });
  });

  it("shows only the requested facility when scoped from a facility page", async () => {
    renderDialog(
      [
        facility("f1", "Affordable Storage Synott", { suggestion: high(SYNOTT) }),
        facility("f2", "Affordable Storage Copperfield", { suggestion: high(COPPERFIELD) }),
      ],
      { facilityIds: ["f2"] }
    );

    expect(await selectFor("Affordable Storage Copperfield")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "ClickUp list for Affordable Storage Synott" })).not.toBeInTheDocument();
  });

  it("explains a load failure instead of showing an empty dialog", async () => {
    getClickUpSuggestions.mockResolvedValue({ kind: "error", message: "Connect your ClickUp account first." });
    listClickUpLists.mockResolvedValue({ kind: "ok", data: { lists: [] } });

    render(<LinkClickUpDialog companyId="c1" companyName="X" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Connect your ClickUp account first.");
  });

  it("Cancel and Escape close without saving", async () => {
    const user = userEvent.setup();
    const handlers = renderDialog([facility("f1", "Affordable Storage Synott", { suggestion: high(SYNOTT) })]);
    await selectFor("Affordable Storage Synott");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");

    expect(handlers.onClose).toHaveBeenCalledTimes(2);
    expect(saveClickUpLinks).not.toHaveBeenCalled();
  });
});
