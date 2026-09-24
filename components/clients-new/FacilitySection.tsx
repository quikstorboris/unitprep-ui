import { DropboxLogo } from "@/components/icons/DropboxLogo";
import type { EditableFacilityFields, PersonAssignment, PreviewedRun } from "@/lib/clientsImport";
import { formatPhone } from "@/lib/format";
import { FACILITY_FIELDS, PEOPLE_ROLE_GROUPS, personKey } from "./clientsNewHelpers";

interface FacilitySectionProps {
  run: PreviewedRun;
  editedFacility: EditableFacilityFields | undefined;
  editing: boolean;
  peoplePool: PersonAssignment[];
  onFieldChange: (runId: string, key: keyof EditableFacilityFields, value: string, isNumber: boolean) => void;
  onTogglePerson: (runId: string, person: PersonAssignment) => void;
  onAddAllForRole: (runId: string, role: string, pool: PersonAssignment[]) => void;
}

/**
 * The Review & Create page's own per-facility section -- every selected
 * run gets one of these, each becoming its own Facility record on
 * Create. Extracted verbatim out of the page's `runs.map(...)`, which
 * still owns all the edited-field/people state (this component only
 * renders it and forwards edits back up).
 */
export function FacilitySection({
  run,
  editedFacility,
  editing,
  peoplePool,
  onFieldChange,
  onTogglePerson,
  onAddAllForRole,
}: FacilitySectionProps) {
  return (
    <section className="rounded border border-slate-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{run.facility.name || run.run_id}</h2>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
          Facility
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm">
          <dt className="text-slate-400">Original Go Live Date</dt>
          <dd>{run.facility.go_live_date || "—"}</dd>
        </div>

        {FACILITY_FIELDS.map((field) => {
          const value = editedFacility?.[field.key];
          // Real Dropbox URLs are long enough (100+ characters,
          // no spaces) to overflow their grid cell and overlap
          // neighboring text when shown as plain text -- render
          // the same compact "Go to DropBox" link the real
          // Facility page uses instead, matching that page's
          // own treatment (see `facilities/[facilityId]/page.tsx`'s
          // `GeneralTab`).
          if (field.key === "dropbox_folder_url" && !editing) {
            return (
              <div key={field.key} className="flex flex-col gap-1 text-sm">
                <dt className="text-slate-400">{field.label}</dt>
                <dd>
                  {typeof value === "string" && value ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-2 rounded bg-[#0061FF] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0050d1]"
                    >
                      <DropboxLogo className="h-4 w-4" />
                      Go to DropBox
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            );
          }

          // `??` (not `||`) preserves a real 0 for units_count --
          // only the phone field gets a special, already-"—"-safe
          // display value (formatPhone never returns a falsy
          // non-empty string).
          const displayValue =
            field.key === "phone" && typeof value === "string" ? formatPhone(value) || "—" : value ?? "—";

          return (
            <div key={field.key} className="flex flex-col gap-1 text-sm">
              <dt className="text-slate-400">{field.label}</dt>
              {editing ? (
                <input
                  type={field.type ?? "text"}
                  value={value ?? ""}
                  onChange={(e) => onFieldChange(run.run_id, field.key, e.target.value, field.type === "number")}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
              ) : (
                <dd className="break-words">{displayValue}</dd>
              )}
            </div>
          );
        })}
      </dl>

      {peoplePool.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">People</h3>
          <div className="flex flex-col gap-3">
            {PEOPLE_ROLE_GROUPS.map((group) => {
              const peopleInGroup = peoplePool.filter((p) => p.role === group.key);
              if (peopleInGroup.length === 0) return null;
              const selectedKeys = new Set((editedFacility?.people ?? []).map(personKey));

              return (
                <div key={group.key} className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddAllForRole(run.run_id, group.key, peoplePool)}
                    className="rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                  >
                    Add All
                  </button>
                  <span className="text-xs text-slate-500">{group.label}:</span>
                  {peopleInGroup.map((person) => {
                    const selected = selectedKeys.has(personKey(person));
                    return (
                      <button
                        key={personKey(person)}
                        type="button"
                        onClick={() => onTogglePerson(run.run_id, person)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        {person.full_name}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
