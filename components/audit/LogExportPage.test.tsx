import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { downloadBlob } = vi.hoisted(() => ({ downloadBlob: vi.fn() }));

vi.mock("@/lib/useSessionAction", () => ({ downloadBlob }));
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import LogExportPage, { type LogExportFilterData } from "./LogExportPage";

interface Row {
  id: number;
  when: string;
  who: string;
}

function filterData(overrides: Partial<LogExportFilterData> = {}): LogExportFilterData {
  return {
    allEventTypes: ["login", "logout"],
    selectedEventTypes: ["login", "logout"],
    setSelectedEventTypes: vi.fn(),
    noEventsSelected: false,
    allUsers: [],
    selectedUserIds: [],
    setSelectedUserIds: vi.fn(),
    filterDataError: null,
    ...overrides,
  };
}

const columns = [
  { header: "When", cell: (row: Row) => row.when },
  { header: "Who", cell: (row: Row) => row.who },
];

function renderPage(overrides: Partial<React.ComponentProps<typeof LogExportPage<Row>>> = {}) {
  const preview = vi.fn().mockResolvedValue({
    kind: "ok",
    data: { rows: [{ id: 1, when: "2026-10-01 09:00", who: "Ada Lovelace" }], truncated: false },
  });
  const exportPdf = vi.fn().mockResolvedValue({
    kind: "ok",
    response: new Response("pdf", { headers: { "Content-Disposition": 'attachment; filename="x.pdf"' } }),
  });
  render(
    <LogExportPage<Row>
      permission="audit_logs.read"
      backHref="/admin/logs"
      backLabel="Back to Logs"
      title="Export Log"
      description="A report."
      userLabel="User"
      fallbackFileName="fallback.pdf"
      filterData={filterData()}
      columns={columns}
      preview={preview}
      exportPdf={exportPdf}
      {...overrides}
    />
  );
  return { preview, exportPdf };
}

function setDates(from: string, to: string) {
  const [fromInput, toInput] = Array.from(document.querySelectorAll('input[type="date"]'));
  fireEvent.change(fromInput, { target: { value: from } });
  fireEvent.change(toInput, { target: { value: to } });
}

describe("LogExportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for a date range first: no preview, export disabled", async () => {
    const { preview } = renderPage();

    expect(screen.getByText("Select a date range to see a preview.")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Export PDF" })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Select a date range to export");
    }
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(preview).not.toHaveBeenCalled();
  });

  it("previews with the chosen range once both dates are set, and lists the rows", async () => {
    const { preview } = renderPage();

    setDates("2026-10-01", "2026-10-07");

    expect(await screen.findByText("Ada Lovelace", undefined, { timeout: 1500 })).toBeInTheDocument();
    expect(preview).toHaveBeenCalledTimes(1);
    expect(preview.mock.calls[0][0]).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-07",
      // Every event type selected means no event filter at all.
      eventTypes: undefined,
      userIds: undefined,
    });
    expect(screen.getByText("Preview: 1 matching event.")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Who" })).toBeInTheDocument();
  });

  it("says when the preview was cut short", async () => {
    renderPage({
      preview: vi.fn().mockResolvedValue({
        kind: "ok",
        data: { rows: [{ id: 1, when: "t", who: "w" }], truncated: true },
      }),
    });

    setDates("2026-10-01", "2026-10-07");

    expect(await screen.findByText(/Preview: 1\+ matching event/, undefined, { timeout: 1500 })).toBeInTheDocument();
  });

  it("will not export while no event type is selected", () => {
    renderPage({ filterData: filterData({ selectedEventTypes: [], noEventsSelected: true }) });

    setDates("2026-10-01", "2026-10-07");

    for (const button of screen.getAllByRole("button", { name: "Export PDF" })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Select at least one event type to export");
    }
  });

  it("exports with the same filters and hands the file to the download helper", async () => {
    const { exportPdf } = renderPage();
    setDates("2026-10-01", "2026-10-07");
    await screen.findByText("Ada Lovelace", undefined, { timeout: 1500 });

    await userEvent.click(screen.getAllByRole("button", { name: "Export PDF" })[0]);

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(exportPdf).toHaveBeenCalledWith({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-07",
      eventTypes: undefined,
      userIds: undefined,
    });
    expect(downloadBlob.mock.calls[0][1]).toBe('attachment; filename="x.pdf"');
    expect(downloadBlob.mock.calls[0][2]).toBe("fallback.pdf");
  });

  it("shows an export failure and downloads nothing", async () => {
    renderPage({ exportPdf: vi.fn().mockResolvedValue({ kind: "error", message: "Export failed" }) });
    setDates("2026-10-01", "2026-10-07");
    await screen.findByText("Ada Lovelace", undefined, { timeout: 1500 });

    await userEvent.click(screen.getAllByRole("button", { name: "Export PDF" })[0]);

    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("shows a preview failure instead of rows", async () => {
    renderPage({ preview: vi.fn().mockResolvedValue({ kind: "error", message: "Preview broke" }) });

    setDates("2026-10-01", "2026-10-07");

    expect(await screen.findByText("Preview broke", undefined, { timeout: 1500 })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
