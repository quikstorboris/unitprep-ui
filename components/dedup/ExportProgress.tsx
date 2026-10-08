import { formatElapsed } from "@/lib/useAbortableOperation";

interface ExportProgressProps {
  exporting: boolean;
  elapsedMs: number;
  onCancel: () => void;
}

/**
 * The export/download button's own elapsed-time label + Cancel button,
 * shown only while generating -- /dedup/export doesn't stream a real
 * percentage, so this is an honest "still working" indicator instead of
 * a fake progress bar. Shared between the pre- and post-download
 * panels below, which each have their own Download button.
 */
export default function ExportProgress({ exporting, elapsedMs, onCancel }: ExportProgressProps) {
  if (!exporting) return null;

  return (
    <span className="inline-flex items-center gap-3 text-sm text-slate-400">
      {formatElapsed(elapsedMs)} elapsed
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-slate-600 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-800"
      >
        Cancel
      </button>
    </span>
  );
}
