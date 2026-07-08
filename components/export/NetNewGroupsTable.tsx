interface NetNewGroupsTableProps {
  groups: string[];
}

export default function NetNewGroupsTable({
  groups,
}: NetNewGroupsTableProps) {
  return (
    <details
      open
      className="rounded border border-slate-700 p-4"
    >
      <summary className="cursor-pointer text-xl font-semibold">
        Net New Groups ({groups.length})
      </summary>

      <div className="mt-4">
        {groups.length === 0 ? (
          <div className="text-slate-400">
            No net new groups detected.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto rounded border border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800">
                  <th className="p-3 text-left">
                    Group Name
                  </th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <tr
                    key={group}
                    className="border-t border-slate-800"
                  >
                    <td className="p-3">
                      {group}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
