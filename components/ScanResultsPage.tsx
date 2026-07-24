"use client";
import { API_URL, basename, errorMessageFrom } from "@/lib/api";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import SessionExpiredPage from "@/components/SessionExpiredPage";
import type {
  ValidateResponse,
  ValidationIssue,
} from "@/types/api";

interface ScanResultsPageProps {
  sessionId: string;
  onBack: () => void;
  onExport: (acknowledged: boolean) => void;
  onSessionExpired: () => void;
}

interface CorrectionFieldProps {
  sessionId: string;
  fileName: string;
  unitNumber: string;
  field: string;
  onSaved: (result: ValidateResponse) => void;
  onSessionExpired: () => void;
}

function CorrectionField({
  sessionId,
  fileName,
  unitNumber,
  field,
  onSaved,
  onSessionExpired,
}: CorrectionFieldProps) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/correct`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            file_name: fileName,
            unit_number: unitNumber,
            field,
            value,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      setSaved(true);
      onSaved(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="w-32 text-sm text-slate-400">
        {field}
      </label>

      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        disabled={saving}
        placeholder="corrected value"
        className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
      />

      <button
        onClick={handleSave}
        disabled={
          saving || !value.trim()
        }
        className="rounded bg-blue-700 px-2 py-1 text-sm disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {saved && (
        <span className="text-sm text-green-400">
          ✓ saved
        </span>
      )}

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

interface ExemptButtonProps {
  sessionId: string;
  fileName: string;
  unitNumber: string;
  onExempted: (
    result: ValidateResponse
  ) => void;
  onSessionExpired: () => void;
}

function ExemptButton({
  sessionId,
  fileName,
  unitNumber,
  onExempted,
  onSessionExpired,
}: ExemptButtonProps) {
  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleExempt = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/exempt-dimensions`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            file_name: fileName,
            unit_number: unitNumber,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      onExempted(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExempt}
        disabled={saving}
        className="rounded bg-slate-600 px-2 py-1 text-sm disabled:opacity-50"
      >
        {saving
          ? "Saving..."
          : "Not a dimensioned unit (office, apartment, etc.)"}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

interface GroupCorrectionCardProps {
  sessionId: string;
  groupName: string;
  /** Only set for a "Rare UnitGroup detected" card — how many units
   * currently share this group name in this file. */
  count?: number;
  onUpdated: (result: ValidateResponse) => void;
  /** Reports the group name back up once exclusion succeeds, so the
   * page can remember it was excluded (not just refresh `results`) --
   * excluding drops a group out of every future `/validate` response
   * entirely, so without this the page would have no way to later show
   * "this was excluded" or offer an undo. */
  onExcluded: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

// One card per distinct UnitGroup name affected by a given warning
// reason — a group-wide fix (rename via `/correct-group`, or exclude
// entirely via `/exclude-group`) rather than a per-unit one, since a
// UnitGroup is by definition shared across many units. Width/Length are
// optional (an odd/non-dimensioned group like "Hertz Office Space" may
// have neither); Additional Properties, if supplied, is concatenated
// onto the dimensions (or the existing name, if dimensions are left
// blank).
function GroupCorrectionCard({
  sessionId,
  groupName,
  count,
  onUpdated,
  onExcluded,
  onSessionExpired,
}: GroupCorrectionCardProps) {
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [
    additionalProperties,
    setAdditionalProperties,
  ] = useState("");
  const [saving, setSaving] = useState(false);
  const [excluding, setExcluding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/correct-group`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            group_name: groupName,
            width: width.trim() || null,
            length: length.trim() || null,
            additional_properties:
              additionalProperties.trim() ||
              null,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      setSaved(true);
      onUpdated(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExclude = async () => {
    try {
      setExcluding(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/exclude-group`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            group_name: groupName,
            excluded: true,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      onExcluded([groupName]);
      onUpdated(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setExcluding(false);
    }
  };

  return (
    <div className="rounded bg-slate-800 p-3">
      <div className="font-semibold">
        {groupName}
        {count !== undefined && (
          <span className="ml-1 font-normal text-slate-400">
            ({count})
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-400">
          Width
        </label>

        <input
          type="text"
          value={width}
          onChange={(e) => {
            setWidth(e.target.value);
            setSaved(false);
          }}
          disabled={saving || excluding}
          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />

        <label className="text-sm text-slate-400">
          Length
        </label>

        <input
          type="text"
          value={length}
          onChange={(e) => {
            setLength(e.target.value);
            setSaved(false);
          }}
          disabled={saving || excluding}
          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />

        <label className="text-sm text-slate-400">
          Additional Properties
        </label>

        <input
          type="text"
          value={additionalProperties}
          onChange={(e) => {
            setAdditionalProperties(
              e.target.value
            );
            setSaved(false);
          }}
          disabled={saving || excluding}
          placeholder="e.g. Ground Floor"
          className="w-48 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />

        <button
          onClick={handleSave}
          disabled={saving || excluding}
          className="rounded bg-blue-700 px-3 py-1 text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={handleExclude}
          disabled={saving || excluding}
          className="rounded bg-slate-600 px-3 py-1 text-sm disabled:opacity-50"
        >
          {excluding
            ? "Excluding..."
            : "Exclude this group"}
        </button>

        {saved && (
          <span className="text-sm text-green-400">
            ✓ saved
          </span>
        )}

        {error && (
          <span className="text-sm text-red-400">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

interface ExcludeAllButtonProps {
  sessionId: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onExcluded: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

// Bulk-excludes every group actually reviewable in *this* section only
// (its own `reviewGroupNames`, not every group this reason's issues
// mention) — a group whose card lives in an earlier section (because
// it's also, say, odd-named) is that earlier section's to exclude, not
// this one's, so this button never reaches into another section's list.
// Some real facility files have dozens of groups sharing no more than a
// handful of units each, and excluding them one card at a time is
// exhausting. Hits `/exclude-groups` (the batch form of
// `/exclude-group`) once rather than firing one request per group.
function ExcludeAllButton({
  sessionId,
  groupNames,
  onUpdated,
  onExcluded,
  onSessionExpired,
}: ExcludeAllButtonProps) {
  const [excluding, setExcluding] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleExcludeAll = async () => {
    try {
      setExcluding(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/exclude-groups`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            group_names: groupNames,
            excluded: true,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      onExcluded(groupNames);
      onUpdated(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setExcluding(false);
    }
  };

  return (
    <>
      <button
        onClick={handleExcludeAll}
        disabled={
          excluding ||
          groupNames.length === 0
        }
        className="rounded bg-slate-600 px-3 py-1 text-sm leading-tight disabled:opacity-50"
      >
        {excluding
          ? "Excluding..."
          : `Exclude All (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </>
  );
}

interface EditGroupsButtonProps {
  sessionId: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onIncluded: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

// Undoes a previous exclusion for every named group at once -- shown
// next to a section's preserved "Excluded Groups" list, in case
// excluding them was a mistake. Hits `/exclude-groups` with
// `excluded: false` (the same batch endpoint "Exclude All" uses, just
// reversed), which brings the groups' units back into every stage of
// validation as if they'd never been excluded.
function EditGroupsButton({
  sessionId,
  groupNames,
  onUpdated,
  onIncluded,
  onSessionExpired,
}: EditGroupsButtonProps) {
  const [
    restoring,
    setRestoring,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleClick = async () => {
    try {
      setRestoring(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/exclude-groups`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            group_names: groupNames,
            excluded: false,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      onIncluded(groupNames);
      onUpdated(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-700 pt-3">
      <button
        onClick={handleClick}
        disabled={
          restoring ||
          groupNames.length === 0
        }
        className="rounded bg-blue-700 px-3 py-1 text-sm disabled:opacity-50"
      >
        {restoring
          ? "Restoring..."
          : `Edit Groups (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

interface ImportAsIsButtonProps {
  sessionId: string;
  check: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onAcknowledged: (
    groupNames: string[]
  ) => void;
  onSessionExpired: () => void;
}

// Accepts *every* group this reason flags "as is" -- deliberately
// `group.groupNames` (the reason's full raw list), not the
// section-owned-only `reviewGroupNames` `ExcludeAllButton` uses. Unlike
// excluding a shared group (which removes its units entirely, resolving
// every check that ever flagged it at once), acknowledging is per-check:
// a group shared with another reason still needs *that* reason's own
// acknowledgment (or fix, or exclude) too, even though its card only
// renders in whichever section owns it -- scoping this button to the
// owned-only subset would silently leave shared groups half-resolved
// forever, keeping Continue disabled even after both sections' buttons
// were clicked.
function ImportAsIsButton({
  sessionId,
  check,
  groupNames,
  onUpdated,
  onAcknowledged,
  onSessionExpired,
}: ImportAsIsButtonProps) {
  const [
    acknowledging,
    setAcknowledging,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleClick = async () => {
    try {
      setAcknowledging(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/acknowledge-group-warnings`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            check,
            group_names: groupNames,
            acknowledged: true,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      onAcknowledged(groupNames);
      onUpdated(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={
          acknowledging ||
          groupNames.length === 0
        }
        className="rounded bg-slate-700 px-3 py-1 text-sm leading-tight disabled:opacity-50"
      >
        {acknowledging
          ? "Importing..."
          : `Import as is (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </>
  );
}

interface UndoImportAsIsButtonProps {
  sessionId: string;
  check: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onUnacknowledged: (
    groupNames: string[]
  ) => void;
  onSessionExpired: () => void;
}

// Undoes a previous "Import as is" acknowledgment for every named group
// at once -- mirrors `EditGroupsButton`, just against
// `/acknowledge-group-warnings` (`acknowledged: false`) instead of
// `/exclude-groups`.
function UndoImportAsIsButton({
  sessionId,
  check,
  groupNames,
  onUpdated,
  onUnacknowledged,
  onSessionExpired,
}: UndoImportAsIsButtonProps) {
  const [
    restoring,
    setRestoring,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const handleClick = async () => {
    try {
      setRestoring(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/acknowledge-group-warnings`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            check,
            group_names: groupNames,
            acknowledged: false,
          }),
        }
      );

      if (response.status === 404) {
        onSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: ValidateResponse =
        await response.json();

      onUnacknowledged(groupNames);
      onUpdated(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-700 pt-3">
      <button
        onClick={handleClick}
        disabled={
          restoring ||
          groupNames.length === 0
        }
        className="rounded bg-blue-700 px-3 py-1 text-sm disabled:opacity-50"
      >
        {restoring
          ? "Restoring..."
          : `Edit Groups (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

// A stable identity for a `ValidationIssue`, since the backend doesn't
// assign one. Used as the list key for `IssueCard` so that saving a
// correction (which drops the fixed issue out of `results.issues` and
// shifts every later issue's array index) can't cause React to reuse an
// `IssueCard`/`CorrectionField`/`ExemptButton` instance — and the
// "✓ saved" state or typed value it holds — for what is now a different,
// still-unresolved issue.
function issueKey(issue: ValidationIssue): string {
  return `${issue.file_name}::${issue.description}::${issue.affected_unit_ids.join(",")}`;
}

function IssueCard({
  issue,
  sessionId,
  onCorrectionSaved,
  onSessionExpired,
}: {
  issue: ValidationIssue;
  sessionId: string;
  onCorrectionSaved: (
    result: ValidateResponse
  ) => void;
  onSessionExpired: () => void;
}) {
  return (
    <li className="rounded bg-slate-800 p-3">
      <div>
        <strong>
          {basename(
            issue.file_name
          )}
        </strong>
      </div>

      <div className="mt-1">
        <span
          className={
            issue.severity === "Error"
              ? "font-semibold text-red-400"
              : "font-semibold text-yellow-400"
          }
        >
          [{issue.severity}]
        </span>{" "}
        {issue.description}
      </div>

      <div className="mt-1 text-sm text-slate-300">
        {issue.detail}
      </div>

      {(issue.correctable_fields.length >
        0 ||
        issue.exemptable) && (
        <div className="mt-3 space-y-3 border-t border-slate-700 pt-3">
          {issue.affected_unit_ids.map(
            (unitId) => (
              <div
                key={unitId}
                className="space-y-2"
              >
                <div className="text-sm text-slate-400">
                  Unit {unitId}
                </div>

                {issue.correctable_fields.map(
                  (field) => (
                    <CorrectionField
                      key={field}
                      sessionId={
                        sessionId
                      }
                      fileName={
                        issue.file_name
                      }
                      unitNumber={
                        unitId
                      }
                      field={field}
                      onSaved={
                        onCorrectionSaved
                      }
                      onSessionExpired={
                        onSessionExpired
                      }
                    />
                  )
                )}

                {issue.exemptable && (
                  <ExemptButton
                    sessionId={
                      sessionId
                    }
                    fileName={
                      issue.file_name
                    }
                    unitNumber={unitId}
                    onExempted={
                      onCorrectionSaved
                    }
                    onSessionExpired={
                      onSessionExpired
                    }
                  />
                )}
              </div>
            )
          )}
        </div>
      )}
    </li>
  );
}

export default function ScanResultsPage({
  sessionId,
  onBack,
  onExport,
  onSessionExpired,
}: ScanResultsPageProps) {
  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [results, setResults] =
    useState<ValidateResponse | null>(
      null
    );

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  // One scroll target per warning reason (the bottom of its own "Groups
  // Needing Review" list), keyed by description -- lets a long list's
  // "Skip to the End" button jump straight there instead of the user
  // scrolling past dozens of cards by hand.
  const reviewListEndRefs = useRef<
    Map<string, HTMLDivElement>
  >(new Map());

  // The latest full picture seen for each warning reason while it still
  // had live issues -- kept even after every one of its groups gets
  // excluded and the reason itself drops out of `results.issues`
  // entirely, so its list stays visible (with an undo) instead of
  // simply vanishing the moment it's resolved.
  const [reasonSnapshots, setReasonSnapshots] =
    useState<
      Map<
        string,
        {
          groupNames: string[];
          occurrenceCounts: Map<
            string,
            number
          >;
        }
      >
    >(new Map());

  // Every group name excluded so far this session, across every reason
  // and every exclude action (single-card or bulk) -- combined with
  // `reasonSnapshots` above, lets a reason that's fully or partially
  // excluded keep showing those names with an "Edit Groups" undo,
  // rather than just disappearing once the backend stops reporting
  // them as live issues.
  const [
    excludedGroupNames,
    setExcludedGroupNames,
  ] = useState<Set<string>>(new Set());

  // Every group name accepted "as is" so far this session, across every
  // reason and every "Import as is" action -- same role as
  // `excludedGroupNames` above, just for acknowledgments instead of
  // exclusions (the data stays; only the flag on it goes away).
  const [
    acknowledgedGroupNames,
    setAcknowledgedGroupNames,
  ] = useState<Set<string>>(new Set());

  // Freezes the top "Warnings" tile at its last non-zero value instead
  // of dropping to 0 the moment everything's excluded -- excluding
  // isn't the same as "there was never anything to review," so the
  // number stays as a record, just recolored to signal it's resolved
  // (see the tile's render below).
  const [
    lastKnownWarningTotal,
    setLastKnownWarningTotal,
  ] = useState(0);

  // Controlled so the outer "Validation Details" accordion can
  // auto-collapse the moment everything resolves (see the effect
  // below), while still opening/closing normally on a manual click the
  // rest of the time.
  const [
    validationDetailsOpen,
    setValidationDetailsOpen,
  ] = useState(false);

  const [
    wasFullyResolved,
    setWasFullyResolved,
  ] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Guards against a slow, stale /validate response from a previous
    // sessionId overwriting state if this component is ever reused
    // across a genuine sessionId change without remounting.
    let ignore = false;

    const runValidation = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/validate`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );

        if (ignore) return;

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(response)
          );
        }

        const data: ValidateResponse =
          await response.json();

        if (!ignore) setResults(data);
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Unknown error"
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    runValidation();

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  const handleResultsUpdated = (
    updated: ValidateResponse
  ) => {
    setResults(updated);
  };

  const handleGroupsExcluded = (
    groupNames: string[]
  ) => {
    setExcludedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.add(name);
      }
      return next;
    });
  };

  const handleGroupsIncluded = (
    groupNames: string[]
  ) => {
    setExcludedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.delete(name);
      }
      return next;
    });
  };

  const handleGroupsAcknowledged = (
    groupNames: string[]
  ) => {
    setAcknowledgedGroupNames(
      (prev) => {
        const next = new Set(prev);
        for (const name of groupNames) {
          next.add(name);
        }
        return next;
      }
    );
  };

  const handleGroupsUnacknowledged = (
    groupNames: string[]
  ) => {
    setAcknowledgedGroupNames(
      (prev) => {
        const next = new Set(prev);
        for (const name of groupNames) {
          next.delete(name);
        }
        return next;
      }
    );
  };

  // Every derived value below is computed defensively (safe when
  // `results` is still null) so the effects further down -- which must
  // be called unconditionally, before any early return -- have
  // something real to close over regardless of loading/error state.
  const errors =
    results?.issues.filter(
      (i) => i.severity === "Error"
    ) ?? [];

  const warnings =
    results?.issues.filter(
      (i) => i.severity !== "Error"
    ) ?? [];

  const filesErrored =
    results?.files_errored ?? [];

  // Gates the bottom Continue button: every error *and* every warning
  // must be fixed or excluded first, not just errors — unlike `ready`
  // (which only reflects export-blocking errors and is still used for
  // the "Export Status" stat tile below).
  const everythingResolved =
    !!results &&
    results.issue_count === 0 &&
    filesErrored.length === 0;

  // Groups warnings by description (e.g. "Rare UnitGroup detected") so
  // the Warnings section can show one collapsible row per reason with
  // its own total count — and, nested inside each, its own "Groups
  // Needing Review" list scoped to just that reason's groups, rather
  // than one big list mixing every reason together.
  const warningsByReason = new Map<
    string,
    ValidationIssue[]
  >();

  for (const warning of warnings) {
    const existing =
      warningsByReason.get(
        warning.description
      ) ?? [];

    existing.push(warning);
    warningsByReason.set(
      warning.description,
      existing
    );
  }

  // A group flagged under more than one reason (e.g. odd-named *and*
  // rare) would otherwise get its own editable "Groups Needing Review"
  // card repeated in every one of those sections -- redundant, since
  // saving or excluding a group from any one card already resolves it
  // everywhere (both endpoints act on the group as a whole, not a
  // per-reason slice of it). Reasons are processed in the same order
  // they're rendered below (first-encountered order from `warnings`
  // above), so whichever section a group's name appears in *first*
  // keeps the actual review card; every later section it's also flagged
  // under still lists it in its own bullet-point summary (that part
  // stays accurate/informational) but skips the duplicate card, noting
  // where the real one lives instead.
  const claimedGroupCards = new Map<
    string,
    string
  >();

  // Pre-seed ownership from history *before* looking at what's live this
  // render, in `reasonSnapshots`' own insertion order (stable: a
  // description's snapshot is first created the first time it's ever
  // live, so this order never changes once established). Without this,
  // a reason that fully resolves (e.g. every one of its groups gets
  // acknowledged or excluded) drops out of `warningsByReason` entirely,
  // and any group it used to own that's *also* flagged under a
  // still-open reason would get re-claimed by that other reason on the
  // very next render -- silently losing track of which check actually
  // acknowledged/excluded it, and with it, the ability to undo that
  // specific action. Pre-seeding keeps ownership stable across a
  // reason's whole live-then-resolved lifetime.
  for (const [
    description,
    snapshot,
  ] of reasonSnapshots.entries()) {
    for (const name of snapshot.groupNames) {
      if (!claimedGroupCards.has(name)) {
        claimedGroupCards.set(
          name,
          description
        );
      }
    }
  }

  const warningReasonGroups = Array.from(
    warningsByReason.entries()
  ).map(([description, issues]) => {
    const groupNames = new Set<string>();
    const occurrenceCounts = new Map<
      string,
      number
    >();

    for (const issue of issues) {
      for (const groupName of issue.affected_group_names) {
        groupNames.add(groupName);
      }

      for (const [
        groupName,
        count,
      ] of issue.group_occurrence_counts) {
        occurrenceCounts.set(
          groupName,
          count
        );
      }
    }

    // For a per-group check (Odd/Rare UnitGroup), `flagged_are_group_names`
    // is true on every issue sharing this description -- the same group
    // name can recur across several files, so summing each issue's own
    // `affected_units` would double-count it and disagree with "Groups
    // Needing Review" below, which is deduplicated by name. A per-unit
    // check (e.g. Invalid Dimensions) has no such dedup step, so it keeps
    // summing affected units.
    const flaggedAreGroupNames =
      issues[0]?.flagged_are_group_names ??
      false;

    const sortedGroupNames = Array.from(
      groupNames
    ).sort();

    // Cards actually rendered here: whichever of this reason's group
    // names are either unclaimed so far or already claimed *by this same
    // reason* (via the historical pre-seeding above -- a name this
    // reason owned before still belongs to it now, not to nobody). Claim
    // any newly-unclaimed ones immediately afterward, in the same pass,
    // so a later reason sharing a name sees it as already spoken for. A
    // name claimed by a *different* reason is dropped from this reason's
    // view entirely (bullets included, not just the card) -- it belongs
    // there and only there, full stop, not repeated here even as a
    // cross-reference.
    const reviewGroupNames =
      sortedGroupNames.filter((name) => {
        const owner =
          claimedGroupCards.get(name);
        return (
          owner === undefined ||
          owner === description
        );
      });

    for (const name of reviewGroupNames) {
      claimedGroupCards.set(
        name,
        description
      );
    }

    return {
      description,
      issues,
      // For a per-group check, count only the names this reason actually
      // owns (matches `reviewGroupNames.length` exactly) rather than
      // every name it flags -- a name claimed by another reason isn't
      // shown anywhere in this section anymore, so it shouldn't be
      // counted here either.
      count: flaggedAreGroupNames
        ? reviewGroupNames.length
        : issues.reduce(
            (sum, issue) =>
              sum + issue.affected_units,
            0
          ),
      groupNames: sortedGroupNames,
      reviewGroupNames,
      occurrenceCounts,
    };
  });

  // The top "Warnings" stat tile used to show `results.warning_count`,
  // which counts warning *issues* (one per file per check type) -- a
  // completely different unit than the per-reason "(N)" counts below it
  // (distinct groups, or distinct units), so the two numbers could look
  // wildly inconsistent (e.g. "18" at the top next to "87" in a single
  // section underneath) even though nothing was wrong. Summing the same
  // per-reason counts shown below makes the top number always equal to
  // what's visibly enumerated underneath it.
  const totalWarningItems =
    warningReasonGroups.reduce(
      (sum, group) => sum + group.count,
      0
    );

  // Merges each currently-live reason (from `warningReasonGroups`
  // above) with any reason `reasonSnapshots` remembers that now has
  // excluded names -- a reason can be live with some of its own
  // history excluded (e.g. Rare still has 5 groups left after 17 were
  // bulk-excluded), or fully resolved and absent from `results.issues`
  // entirely (every one of its groups excluded), in which case it only
  // exists here via its snapshot. Either way the section keeps
  // rendering instead of disappearing outright.
  type ReasonSection = {
    description: string;
    isLive: boolean;
    count: number;
    issues: ValidationIssue[];
    groupNames: string[];
    reviewGroupNames: string[];
    occurrenceCounts: Map<
      string,
      number
    >;
    excludedNames: string[];
    acknowledgedNames: string[];
  };

  const reasonSectionsByDescription =
    new Map<string, ReasonSection>();

  for (const g of warningReasonGroups) {
    reasonSectionsByDescription.set(
      g.description,
      {
        description: g.description,
        isLive: true,
        count: g.count,
        issues: g.issues,
        groupNames: g.groupNames,
        reviewGroupNames:
          g.reviewGroupNames,
        occurrenceCounts:
          g.occurrenceCounts,
        excludedNames: [],
        acknowledgedNames: [],
      }
    );
  }

  for (const [
    description,
    snapshot,
  ] of reasonSnapshots.entries()) {
    const existing =
      reasonSectionsByDescription.get(
        description
      );

    const liveGroupNames =
      existing?.groupNames ?? [];

    // Extends the same first-claim ownership used above for live
    // review cards to historical (excluded/acknowledged) names too --
    // otherwise a group flagged under two reasons (e.g. both odd and
    // rare) would show its "Excluded Groups"/"Imported As Is" entry in
    // *both* sections, the same duplication problem the live cards
    // already had fixed. Reasons are visited here in the order their
    // snapshot was first created, which (since `issues::build` always
    // raises Odd before Rare for a given file) matches the page's own
    // top-to-bottom order, so whichever section owns a name's live
    // card also owns its history entries.
    for (const name of snapshot.groupNames) {
      if (!claimedGroupCards.has(name)) {
        claimedGroupCards.set(
          name,
          description
        );
      }
    }

    const ownedHistoricalNames =
      snapshot.groupNames.filter(
        (name) =>
          !liveGroupNames.includes(
            name
          ) &&
          claimedGroupCards.get(
            name
          ) === description
      );

    const excludedNames =
      ownedHistoricalNames.filter(
        (name) =>
          excludedGroupNames.has(
            name
          )
      );

    const acknowledgedNames =
      ownedHistoricalNames.filter(
        (name) =>
          acknowledgedGroupNames.has(
            name
          )
      );

    if (
      excludedNames.length === 0 &&
      acknowledgedNames.length === 0
    ) {
      continue;
    }

    if (existing) {
      existing.excludedNames =
        excludedNames;
      existing.acknowledgedNames =
        acknowledgedNames;
    } else {
      reasonSectionsByDescription.set(
        description,
        {
          description,
          isLive: false,
          count: 0,
          issues: [],
          groupNames: [],
          reviewGroupNames: [],
          occurrenceCounts:
            snapshot.occurrenceCounts,
          excludedNames,
          acknowledgedNames,
        }
      );
    }
  }

  const reasonSections = Array.from(
    reasonSectionsByDescription.values()
  );

  // The three blocks below adjust state *during* render rather than in
  // a `useEffect` -- React's documented pattern for "remember something
  // from a previous render and update state in response," which avoids
  // the extra effect-triggered render pass a `useEffect` would cost
  // here. Each is guarded by a content comparison (not just "did the
  // render happen") specifically so it converges instead of looping:
  // once the state matches what the guard checks for, the condition is
  // false and no further update happens.
  if (results) {
    let nextReasonSnapshots =
      reasonSnapshots;
    let snapshotsChanged = false;

    for (const g of warningReasonGroups) {
      const existing =
        reasonSnapshots.get(
          g.description
        );

      const existingNames = new Set(
        existing?.groupNames ?? []
      );

      // Only ever *grows* a reason's remembered name list -- a name
      // dropping out of the current live list means it was excluded,
      // not that it was never really part of this reason. Overwriting
      // the snapshot with the shrunken live list here would erase the
      // very history "Excluded Groups" depends on, the moment the
      // first group in a reason gets excluded.
      const hasNewNames =
        g.groupNames.some(
          (name) =>
            !existingNames.has(name)
        );

      if (!existing || hasNewNames) {
        if (!snapshotsChanged) {
          nextReasonSnapshots = new Map(
            reasonSnapshots
          );
          snapshotsChanged = true;
        }

        const mergedNames = existing
          ? Array.from(
              new Set([
                ...existing.groupNames,
                ...g.groupNames,
              ])
            ).sort()
          : g.groupNames;

        const mergedCounts = new Map(
          existing?.occurrenceCounts ??
            []
        );

        for (const [
          name,
          count,
        ] of g.occurrenceCounts.entries()) {
          mergedCounts.set(
            name,
            count
          );
        }

        nextReasonSnapshots.set(
          g.description,
          {
            groupNames: mergedNames,
            occurrenceCounts:
              mergedCounts,
          }
        );
      }
    }

    if (snapshotsChanged) {
      setReasonSnapshots(
        nextReasonSnapshots
      );
    }
  }

  if (
    totalWarningItems > 0 &&
    totalWarningItems !==
      lastKnownWarningTotal
  ) {
    setLastKnownWarningTotal(
      totalWarningItems
    );
  }

  if (
    !wasFullyResolved &&
    everythingResolved &&
    validationDetailsOpen
  ) {
    setValidationDetailsOpen(false);
  }

  if (
    wasFullyResolved !==
    everythingResolved
  ) {
    setWasFullyResolved(
      everythingResolved
    );
  }

  if (sessionExpired) {
    return (
      <SessionExpiredPage
        onHome={onSessionExpired}
      />
    );
  }

  if (loading) {
    return (
      <div className="text-slate-100">
        Loading validation results...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400">
        Error: {error}
      </div>
    );
  }

  if (!results) {
    return (
      <div className="text-red-400">
        No validation results available.
      </div>
    );
  }

  const displayedWarningTotal =
    totalWarningItems > 0
      ? totalWarningItems
      : lastKnownWarningTotal;

  const warningsAllResolved =
    totalWarningItems === 0 &&
    lastKnownWarningTotal > 0;

  return (
    <div className="mx-auto max-w-5xl text-slate-100">
      <div className="mb-6 flex gap-4">
        <button
          onClick={onBack}
          className="rounded bg-slate-700 px-4 py-2"
        >
          ← Back
        </button>
      </div>

      <h1 className="mb-8 text-3xl font-bold">
        Validation Results
      </h1>

      <div className="grid grid-cols-5 gap-4">
        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Files Checked
          </div>

          <div className="text-2xl font-bold">
            {results.files_checked}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Errors
          </div>

          <div className="text-2xl font-bold text-red-400">
            {results.error_count}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Warnings
          </div>

          <div
            className={
              warningsAllResolved
                ? "text-2xl font-bold text-slate-500"
                : "text-2xl font-bold text-yellow-400"
            }
          >
            {displayedWarningTotal}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Files Errored
          </div>

          <div
            className={
              filesErrored.length > 0
                ? "text-2xl font-bold text-red-400"
                : "text-2xl font-bold"
            }
          >
            {filesErrored.length}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Export Status
          </div>

          <div
            className={
              !results.ready
                ? "text-left text-2xl font-bold text-red-400"
                : totalWarningItems >
                  0
                ? "text-left text-2xl font-bold text-yellow-400"
                : "text-left text-2xl font-bold"
            }
          >
            {!results.ready
              ? "❌ Blocked"
              : totalWarningItems > 0
              ? "⚠️ Resolve Warnings"
              : "✅ Allowed"}
          </div>
        </div>
      </div>

      {results.issue_count === 0 &&
      filesErrored.length === 0 ? (
        <div className="mt-6 rounded bg-green-900 p-4">
          ✅ Validation completed
          successfully.
        </div>
      ) : results.error_count > 0 ||
        filesErrored.length > 0 ? (
        <div className="mt-6 rounded bg-red-900 p-4">
          ❌{" "}
          {results.error_count > 0 && (
            <>
              {results.error_count}{" "}
              error
              {results.error_count === 1
                ? ""
                : "s"}
            </>
          )}
          {results.error_count > 0 &&
            filesErrored.length > 0 &&
            " and "}
          {filesErrored.length > 0 && (
            <>
              {filesErrored.length} file
              {filesErrored.length === 1
                ? ""
                : "s"} that could not
              be validated
            </>
          )}{" "}
          must be resolved before
          export.
        </div>
      ) : results.issue_count > 0 ? (
        <div className="mt-6 rounded bg-yellow-900 p-4">
          ⚠ Advisory findings
          detected. Review
          recommended.
        </div>
      ) : null}

      <details
        className="mt-8"
        open={validationDetailsOpen}
        onToggle={(e) =>
          setValidationDetailsOpen(
            e.currentTarget.open
          )
        }
      >
        <summary className="cursor-pointer font-semibold">
          Validation Details
        </summary>

        <div className="mt-4 space-y-4">
          {errors.length === 0 &&
          filesErrored.length === 0 &&
          reasonSections.length === 0 ? (
            <p>No issues found.</p>
          ) : (
            <>
              <details className="rounded border border-slate-700 p-4">
                <summary className="cursor-pointer font-semibold text-red-400">
                  Errors ({errors.length})
                </summary>

                {errors.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No errors.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {errors.map(
                      (issue) => (
                        <IssueCard
                          key={issueKey(issue)}
                          issue={issue}
                          sessionId={
                            sessionId
                          }
                          onCorrectionSaved={
                            handleResultsUpdated
                          }
                          onSessionExpired={() =>
                            setSessionExpired(
                              true
                            )
                          }
                        />
                      )
                    )}
                  </ul>
                )}
              </details>

              <details className="rounded border border-slate-700 p-4">
                <summary className="cursor-pointer font-semibold text-red-400">
                  File Errors (
                  {filesErrored.length})
                </summary>

                {filesErrored.length ===
                0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No file errors.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1">
                    {filesErrored.map(
                      (
                        fileError,
                        index
                      ) => (
                        <li
                          key={`${fileError.file_name}-${index}`}
                          className="text-sm text-red-200"
                        >
                          <strong>
                            {basename(
                              fileError.file_name
                            )}
                          </strong>{" "}
                          —{" "}
                          {
                            fileError.message
                          }
                        </li>
                      )
                    )}
                  </ul>
                )}
              </details>

              <details className="rounded border border-slate-700 p-4">
                <summary
                  className={
                    warningsAllResolved
                      ? "cursor-pointer font-semibold text-slate-500"
                      : "cursor-pointer font-semibold text-yellow-400"
                  }
                >
                  Warnings (
                  {
                    displayedWarningTotal
                  }
                  )
                </summary>

                {reasonSections.length ===
                0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No warnings.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {reasonSections.map(
                      (group) => (
                        <details
                          key={
                            group.description
                          }
                          className="rounded bg-slate-800 p-3"
                        >
                          <summary className="cursor-pointer text-sm font-medium text-slate-200">
                            {
                              group.description
                            }{" "}
                            (
                            {group.isLive
                              ? group.count
                              : 0}
                            {group
                              .excludedNames
                              .length >
                              0 &&
                              `, ${group.excludedNames.length} excluded`}
                            {group
                              .acknowledgedNames
                              .length >
                              0 &&
                              `, ${group.acknowledgedNames.length} imported as is`}

                            )
                          </summary>

                          {group.isLive && (
                            <ul className="mt-2 space-y-2 text-sm text-slate-300">
                              {group.issues.map(
                                (
                                  issue
                                ) => {
                                  const rawItems =
                                    issue.flagged_are_group_names
                                      ? issue.affected_group_names
                                      : issue.affected_unit_ids;

                                  // A group-based issue's own names are
                                  // filtered to this reason's owned set
                                  // (`reviewGroupNames`) -- a name
                                  // claimed by another reason belongs
                                  // there and only there, not repeated
                                  // here even informationally. Per-unit
                                  // issues have no such ownership
                                  // concept, so their items pass through
                                  // untouched.
                                  const items =
                                    issue.flagged_are_group_names
                                      ? rawItems.filter(
                                          (item) =>
                                            group.reviewGroupNames.includes(
                                              item
                                            )
                                        )
                                      : rawItems;

                                  if (
                                    items.length ===
                                    0
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <li
                                      key={issueKey(
                                        issue
                                      )}
                                    >
                                      <strong>
                                        {basename(
                                          issue.file_name
                                        )}
                                      </strong>

                                      <ul className="ml-4 list-disc space-y-0.5">
                                        {items.map(
                                          (
                                            item
                                          ) => {
                                            const occurrenceCount =
                                              group.occurrenceCounts.get(
                                                item
                                              );

                                            return (
                                              <li
                                                key={
                                                  item
                                                }
                                              >
                                                {
                                                  item
                                                }
                                                {occurrenceCount !==
                                                  undefined && (
                                                  <span className="text-slate-400">
                                                    {" "}
                                                    (
                                                    {
                                                      occurrenceCount
                                                    }

                                                    )
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          }
                                        )}
                                      </ul>
                                    </li>
                                  );
                                }
                              )}
                            </ul>
                          )}

                          {group.isLive &&
                            group
                              .reviewGroupNames
                              .length > 0 && (
                            <div className="mt-3 rounded border border-slate-700 p-3">
                              <div className="mb-2 flex items-center justify-between gap-4">
                                <div className="text-sm font-medium text-slate-200">
                                  Groups
                                  Needing
                                  Review
                                </div>

                                {group
                                  .reviewGroupNames
                                  .length >
                                  15 && (
                                  <button
                                    onClick={() =>
                                      reviewListEndRefs.current
                                        .get(
                                          group.description
                                        )
                                        ?.scrollIntoView(
                                          {
                                            behavior:
                                              "smooth",
                                            block:
                                              "start",
                                          }
                                        )
                                    }
                                    className="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
                                  >
                                    Skip to
                                    the End
                                    ↓
                                  </button>
                                )}
                              </div>

                              {group
                                .reviewGroupNames
                                .length >
                                0 && (
                                <div className="space-y-3">
                                  {group.reviewGroupNames.map(
                                    (
                                      groupName
                                    ) => (
                                      <GroupCorrectionCard
                                        key={
                                          groupName
                                        }
                                        sessionId={
                                          sessionId
                                        }
                                        groupName={
                                          groupName
                                        }
                                        count={group.occurrenceCounts.get(
                                          groupName
                                        )}
                                        onUpdated={
                                          handleResultsUpdated
                                        }
                                        onExcluded={
                                          handleGroupsExcluded
                                        }
                                        onSessionExpired={() =>
                                          setSessionExpired(
                                            true
                                          )
                                        }
                                      />
                                    )
                                  )}
                                </div>
                              )}

                              <div
                                ref={(
                                  el
                                ) => {
                                  if (el) {
                                    reviewListEndRefs.current.set(
                                      group.description,
                                      el
                                    );
                                  }
                                }}
                                className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-700 pt-3"
                              >
                                <ExcludeAllButton
                                  sessionId={
                                    sessionId
                                  }
                                  groupNames={
                                    group.reviewGroupNames
                                  }
                                  onUpdated={
                                    handleResultsUpdated
                                  }
                                  onExcluded={
                                    handleGroupsExcluded
                                  }
                                  onSessionExpired={() =>
                                    setSessionExpired(
                                      true
                                    )
                                  }
                                />

                                <ImportAsIsButton
                                  sessionId={
                                    sessionId
                                  }
                                  check={
                                    group.description
                                  }
                                  groupNames={
                                    group.groupNames
                                  }
                                  onUpdated={
                                    handleResultsUpdated
                                  }
                                  onAcknowledged={
                                    handleGroupsAcknowledged
                                  }
                                  onSessionExpired={() =>
                                    setSessionExpired(
                                      true
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {group
                            .excludedNames
                            .length >
                            0 && (
                            <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3">
                              <div className="mb-2 text-sm font-medium text-slate-400">
                                Excluded
                                Groups (
                                {
                                  group
                                    .excludedNames
                                    .length
                                }

                                )
                              </div>

                              <ul className="mb-3 ml-4 list-disc space-y-0.5 text-sm text-slate-400">
                                {group.excludedNames.map(
                                  (
                                    name
                                  ) => {
                                    const occurrenceCount =
                                      group.occurrenceCounts.get(
                                        name
                                      );

                                    return (
                                      <li
                                        key={
                                          name
                                        }
                                      >
                                        {
                                          name
                                        }
                                        {occurrenceCount !==
                                          undefined && (
                                          <span>
                                            {" "}
                                            (
                                            {
                                              occurrenceCount
                                            }

                                            )
                                          </span>
                                        )}
                                      </li>
                                    );
                                  }
                                )}
                              </ul>

                              <EditGroupsButton
                                sessionId={
                                  sessionId
                                }
                                groupNames={
                                  group.excludedNames
                                }
                                onUpdated={
                                  handleResultsUpdated
                                }
                                onIncluded={
                                  handleGroupsIncluded
                                }
                                onSessionExpired={() =>
                                  setSessionExpired(
                                    true
                                  )
                                }
                              />
                            </div>
                          )}

                          {group
                            .acknowledgedNames
                            .length >
                            0 && (
                            <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3">
                              <div className="mb-2 text-sm font-medium text-slate-400">
                                Imported
                                As Is (
                                {
                                  group
                                    .acknowledgedNames
                                    .length
                                }

                                )
                              </div>

                              <ul className="mb-3 ml-4 list-disc space-y-0.5 text-sm text-slate-400">
                                {group.acknowledgedNames.map(
                                  (
                                    name
                                  ) => {
                                    const occurrenceCount =
                                      group.occurrenceCounts.get(
                                        name
                                      );

                                    return (
                                      <li
                                        key={
                                          name
                                        }
                                      >
                                        {
                                          name
                                        }
                                        {occurrenceCount !==
                                          undefined && (
                                          <span>
                                            {" "}
                                            (
                                            {
                                              occurrenceCount
                                            }

                                            )
                                          </span>
                                        )}
                                      </li>
                                    );
                                  }
                                )}
                              </ul>

                              <UndoImportAsIsButton
                                sessionId={
                                  sessionId
                                }
                                check={
                                  group.description
                                }
                                groupNames={
                                  group.acknowledgedNames
                                }
                                onUpdated={
                                  handleResultsUpdated
                                }
                                onUnacknowledged={
                                  handleGroupsUnacknowledged
                                }
                                onSessionExpired={() =>
                                  setSessionExpired(
                                    true
                                  )
                                }
                              />
                            </div>
                          )}
                        </details>
                      )
                    )}
                  </div>
                )}
              </details>
            </>
          )}
        </div>
      </details>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-700 pt-6">
        <button
          onClick={() => onExport(false)}
          disabled={!everythingResolved}
          className="rounded bg-green-600 px-4 py-2 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Continue
        </button>

        {!everythingResolved && (
          <span className="text-sm text-slate-400">
            Fix, exclude, or import as is
            every warning above to continue.
          </span>
        )}
      </div>
    </div>
  );
}
