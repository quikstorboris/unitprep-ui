import type {
  DedupClassifyResponse,
  DedupFileClassification,
  DedupFileRequirementsResponse,
} from "@/types/api";

// Shared fixtures for the dedup folder-flow tests.

export function classified(
  file_name: string,
  overrides: Partial<DedupFileClassification> = {}
): DedupFileClassification {
  return {
    file_name,
    path: null,
    status: "recognized",
    format_name: "SiteLink Directory",
    pms: "SiteLink",
    report_name: "Directory",
    role: "primary",
    selection_priority: 1,
    ...overrides,
  };
}

/** A SiteLink folder: Directory.xlsx (preferred), Directory.csv (its alternative), notes, a supporting file. */
export function folderResponse(): DedupClassifyResponse {
  return {
    files: [
      classified("Directory.xlsx"),
      classified("Directory.csv", { selection_priority: 2 }),
      classified("Ledgers.csv", {
        format_name: "SiteLink Ledgers",
        report_name: "Ledgers",
        role: "supporting",
      }),
      classified("notes.csv", {
        status: "unrecognized",
        format_name: null,
        pms: null,
        report_name: null,
        role: null,
      }),
      classified("old.xls", {
        status: "unreadable",
        format_name: null,
        pms: null,
        report_name: null,
        role: null,
      }),
    ],
    suggested: {
      pms: "SiteLink",
      selected: ["Directory.xlsx"],
      alternatives: { "Directory.csv": "Directory.xlsx" },
    },
  };
}

export function requirementsResponse(): DedupFileRequirementsResponse {
  return {
    vendors: [
      {
        pms: "QSX",
        formats: [
          {
            name: "QSX End Users",
            report_name: "End Users",
            role: "primary",
            selection_priority: 1,
            guidance: "Export End Users from QSX.",
          },
        ],
      },
      {
        pms: "SiteLink",
        formats: [
          {
            name: "SiteLink Directory",
            report_name: "Directory",
            role: "primary",
            selection_priority: 1,
            guidance: "Step one.\nStep two.",
          },
          {
            name: "SiteLink Ledgers",
            report_name: "Ledgers",
            role: "supporting",
            selection_priority: 2,
            guidance: "Ledger guidance.",
          },
        ],
      },
    ],
  };
}
