import type { AdvisoryIssue } from "@/types/api";

interface AdvisoryIssuesTableProps {
  issues: AdvisoryIssue[];
}

export default function AdvisoryIssuesTable({
  issues,
}: AdvisoryIssuesTableProps) {
  return (
    <details className="rounded border border-slate-700 p-4">
      <summary className="cursor-pointer text-xl font-semibold">
        Advisory Issues ({issues.length}
        )
      </summary>

      <div className="mt-4">
        {issues.length === 0 ? (
          <div className="text-green-400">
            No advisory issues detected.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800">
                  <th className="p-3 text-left">
                    Source
                  </th>

                  <th className="p-3 text-left">
                    Severity
                  </th>

                  <th className="p-3 text-left">
                    Issue
                  </th>
                </tr>
              </thead>

              <tbody>
                {issues.map(
                  (issue, index) => (
                    <tr
                      key={`${issue.source}-${index}`}
                      className="border-t border-slate-800"
                    >
                      <td className="p-3">
                        {issue.source}
                      </td>

                      <td className="p-3">
                        {issue.severity}
                      </td>

                      <td className="p-3">
                        {issue.issue}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
