import type { PreviewedRun } from "@/lib/clientsImport";

interface PrimaryFacilityPickerProps {
  runs: PreviewedRun[];
  selectedRunId: string | null;
  /** The run Process Street's own data points at (answered "first time"
   * and has the most corporate info) -- offered as a hint, never chosen. */
  suggestedRunId: string;
  onSelect: (runId: string) => void;
}

/**
 * Required on the Review & Create page whenever more than one facility is
 * selected: which one is the company's "parent" -- the facility whose
 * Corporate Info seeds the Company section and whose Process Street run is
 * recorded as the company's source. Nothing is preselected; Create stays
 * disabled until one is chosen, because guessing wrong silently gives the
 * company another facility's (or no) corporate data.
 */
export function PrimaryFacilityPicker({
  runs,
  selectedRunId,
  suggestedRunId,
  onSelect,
}: PrimaryFacilityPickerProps) {
  return (
    <section className="rounded border border-amber-800 bg-amber-950/10 p-5">
      <h2 className="text-lg font-semibold">Primary facility</h2>
      <p className="mt-1 text-sm text-slate-400">
        Choose the facility that stands for this company. Its corporate
        information fills the Company section below. Usually this is the one
        whose intake form was filled out first.
      </p>

      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="sr-only">Primary facility</legend>
        {runs.map((run) => (
          <label
            key={run.run_id}
            className="flex items-center gap-3 text-sm text-slate-200"
          >
            <input
              type="radio"
              name="primary-facility"
              checked={selectedRunId === run.run_id}
              onChange={() => onSelect(run.run_id)}
            />
            <span>{run.facility.name || run.run_id}</span>
            {run.run_id === suggestedRunId && (
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                suggested
              </span>
            )}
          </label>
        ))}
      </fieldset>

      {selectedRunId === null && (
        <p className="mt-3 text-sm text-amber-400">
          Select a primary facility to continue.
        </p>
      )}
    </section>
  );
}
