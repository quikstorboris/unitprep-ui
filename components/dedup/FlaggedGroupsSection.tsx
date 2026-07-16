import type { FlaggedGroup } from "@/types/api";

interface FlaggedGroupsSectionProps {
  groups: FlaggedGroup[];
}

export default function FlaggedGroupsSection({
  groups,
}: FlaggedGroupsSectionProps) {
  return (
    <details
      open
      className="rounded border border-slate-700 p-4"
    >
      <summary className="cursor-pointer text-xl font-semibold">
        Flagged Groups ({groups.length})
      </summary>

      <div className="mt-4 space-y-4">
        {groups.length === 0 ? (
          <div className="text-green-400">
            No duplicate tenants flagged.
          </div>
        ) : (
          groups.map(
            (flagged, index) => (
              <div
                key={`${flagged.group.key}-${index}`}
                className="rounded border border-slate-800 p-4"
              >
                <div className="mb-2 font-semibold">
                  {flagged.group.key}
                  {" — Units: "}
                  {flagged.group.records
                    .map(
                      (record) =>
                        record.unit_number
                    )
                    .join(", ")}
                </div>

                <div className="text-sm text-slate-300">
                  {flagged.note}
                </div>

                <details className="mt-3 rounded border border-slate-700 p-3">
                  <summary className="cursor-pointer text-sm text-slate-400">
                    What differs (
                    {
                      flagged.mismatches
                        .length
                    }
                    )
                  </summary>

                  <div className="mt-2 space-y-2">
                    {flagged.mismatches.map(
                      (
                        mismatch,
                        mismatchIndex
                      ) => (
                        <div
                          key={`${mismatch.category}-${mismatchIndex}`}
                        >
                          <div className="text-sm font-semibold text-slate-300">
                            {
                              mismatch.category
                            }
                          </div>

                          {mismatch.fields.map(
                            (field) => (
                              <div
                                key={
                                  field.field
                                }
                                className="ml-3 text-sm text-slate-400"
                              >
                                {
                                  field.field
                                }
                                :{" "}
                                {field.values.join(
                                  " vs. "
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )
                    )}
                  </div>
                </details>
              </div>
            )
          )
        )}
      </div>
    </details>
  );
}
