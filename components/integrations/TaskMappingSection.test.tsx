import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskMappingSection } from "./TaskMappingSection";

const ROLE = {
  role: "qms_credentials",
  label: "Credentials added to QMS",
  description: "The credentials step.",
  task_names: ["Document Credentials", "Add Credentials to QMS"],
  facilities_total: 45,
  facilities_matched: 44,
};

function stubFetch(handler: (url: string, init: RequestInit) => unknown) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    return new Response(JSON.stringify(handler(url, init)), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("TaskMappingSection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows each mapped name and the coverage readout", async () => {
    stubFetch(() => ({ roles: [ROLE] }));

    render(<TaskMappingSection />);

    expect(await screen.findByText("Document Credentials")).toBeInTheDocument();
    expect(screen.getByText("Add Credentials to QMS")).toBeInTheDocument();
    expect(screen.getByText(/Matched in 44 of 45 facilities/)).toBeInTheDocument();
  });

  it("adds a name, saves the whole list, and shows the saved confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch((_url, init) =>
      init.method === "PUT"
        ? { ...ROLE, task_names: [...ROLE.task_names, "Collect Credentials"], facilities_matched: 45 }
        : { roles: [ROLE] }
    );

    render(<TaskMappingSection />);
    await screen.findByText("Document Credentials");

    const save = screen.getByRole("button", { name: "Save mapping" });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/Add a .* task name/), "Collect Credentials{Enter}");
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(screen.getByText("Saved.")).toBeInTheDocument());
    const putCall = fetchMock.mock.calls.find(([, init]) => init.method === "PUT");
    expect(JSON.parse(putCall![1].body as string)).toEqual({
      task_names: ["Document Credentials", "Add Credentials to QMS", "Collect Credentials"],
    });
    expect(screen.getByText(/Matched in 45 of 45/)).toBeInTheDocument();
  });

  it("ignores a name that is already there, case-insensitively", async () => {
    const user = userEvent.setup();
    stubFetch(() => ({ roles: [ROLE] }));

    render(<TaskMappingSection />);
    await screen.findByText("Document Credentials");

    await user.type(screen.getByLabelText(/Add a .* task name/), "document credentials{Enter}");

    expect(screen.getByRole("button", { name: "Save mapping" })).toBeDisabled();
  });

  it("will not let the last name be removed", async () => {
    stubFetch(() => ({ roles: [{ ...ROLE, task_names: ["Document Credentials"] }] }));

    render(<TaskMappingSection />);
    await screen.findByText("Document Credentials");

    expect(screen.getByRole("button", { name: "Remove Document Credentials" })).toBeDisabled();
  });
});
