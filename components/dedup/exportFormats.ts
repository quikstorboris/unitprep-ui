import type { DedupExportFormat } from "@/types/api";

export const FORMAT_OPTIONS: Array<{
  value: DedupExportFormat;
  label: string;
}> = [
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV" },
  {
    value: "both",
    label: "Both (as a .zip)",
  },
];
