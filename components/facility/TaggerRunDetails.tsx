import type { TaggerRunSummary } from "@/types/api";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-700 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

/** A Template Tagger run: the template, how many places were found, how
 * many needed review, and how many substitutions the reviewer applied. */
export function TaggerRunDetails({ summary }: { summary: TaggerRunSummary }) {
  const tags = Object.entries(summary.tags ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <>
      <div className="text-sm text-slate-300">
        <span className="text-slate-500">Template: </span>
        {summary.template_file}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Places found" value={summary.candidate_count} />
        <Stat label="Needed review" value={summary.needs_review_count} />
        <Stat
          label="Tags applied"
          value={summary.applied_count ?? "Not applied"}
        />
      </div>

      {summary.applied_count !== null &&
        summary.preserve_blanks !== undefined && (
          <div className="text-sm text-slate-400">
            {summary.preserve_blanks
              ? "Each tag was placed inside its blank, keeping the blank's underline."
              : "Each blank was replaced by its tag."}
          </div>
        )}

      {tags.length > 0 && (
        <details className="rounded border border-slate-700 p-4">
          <summary className="cursor-pointer text-xl font-semibold">
            Tags found ({tags.length})
          </summary>

          <div className="mt-4 max-h-96 overflow-auto rounded border border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800">
                  <th className="p-3 text-left">Tag</th>
                  <th className="p-3 text-left">Places</th>
                </tr>
              </thead>

              <tbody>
                {tags.map(([tag, count]) => (
                  <tr key={tag} className="border-t border-slate-800">
                    <td className="p-3">{tag}</td>
                    <td className="p-3">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
