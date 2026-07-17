"use client";
import { API_URL, errorMessageFrom } from "@/lib/api";
import { useEffect, useState } from "react";
import SessionExpiredPage from "@/components/SessionExpiredPage";
import type {
  ValidateResponse,
  ValidationIssue,
} from "@/types/api";

interface ScanResultsPageProps {
  sessionId: string;
  onBack: () => void;
  onExport: (acknowledged: boolean) => void;
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
          {issue.file_name}
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
}: ScanResultsPageProps) {
  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [results, setResults] =
    useState<ValidateResponse | null>(
      null
    );

  const [
    acknowledged,
    setAcknowledged,
  ] = useState(false);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  useEffect(() => {
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

        setResults(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error"
        );
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      runValidation();
    }
  }, [sessionId]);

  // A saved correction can clear the error that justified the earlier
  // acknowledgment, so require the user to look again rather than carrying
  // a stale "export anyway" decision forward.
  const handleCorrectionSaved = (
    updated: ValidateResponse
  ) => {
    setResults(updated);
    setAcknowledged(false);
  };

  if (sessionExpired) {
    return (
      <SessionExpiredPage
        onHome={onBack}
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

  const errors = results.issues.filter(
    (i) => i.severity === "Error"
  );

  const warnings = results.issues.filter(
    (i) => i.severity !== "Error"
  );

  const filesErrored =
    results.files_errored;

  // `ready` already accounts for both causes (unresolved errors and
  // files that couldn't be validated at all) — trust it rather than
  // re-deriving from error_count alone, which would silently leave no
  // way to override in a files-errored-only case.
  const canExport =
    results.ready || acknowledged;

  const blockingReasons: string[] = [];

  if (errors.length > 0) {
    blockingReasons.push(
      `${errors.length} error${
        errors.length === 1 ? "" : "s"
      }`
    );
  }

  if (filesErrored.length > 0) {
    blockingReasons.push(
      `${filesErrored.length} file${
        filesErrored.length === 1
          ? ""
          : "s"
      } that could not be validated`
    );
  }

  return (
    <div className="mx-auto max-w-5xl text-slate-100">
      <div className="mb-6 flex gap-4">
        <button
          onClick={onBack}
          className="rounded bg-slate-700 px-4 py-2"
        >
          ← Back
        </button>

        <button
          disabled={!canExport}
          onClick={() =>
            onExport(acknowledged)
          }
          className="rounded bg-green-600 px-4 py-2 disabled:opacity-50"
        >
          Confirm & Export
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

          <div className="text-2xl font-bold text-yellow-400">
            {results.warning_count}
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

          <div className="text-2xl font-bold">
            {canExport
              ? "✅ Allowed"
              : "❌ Blocked"}
          </div>
        </div>
      </div>

      {filesErrored.length > 0 && (
        <div className="mt-6 rounded border border-red-800 bg-red-950 p-4">
          <div className="font-semibold text-red-300">
            ⚠ {filesErrored.length} file
            {filesErrored.length === 1
              ? ""
              : "s"}{" "}
            could not be validated
          </div>

          <div className="mt-1 text-sm text-red-200">
            This usually indicates a bug
            in the tool rather than a
            problem with your data —
            contact support with the
            details below.
          </div>

          <ul className="mt-3 space-y-1">
            {filesErrored.map(
              (fileError, index) => (
                <li
                  key={`${fileError.file_name}-${index}`}
                  className="text-sm text-red-100"
                >
                  <strong>
                    {
                      fileError.file_name
                    }
                  </strong>{" "}
                  — {fileError.message}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {results.issue_count === 0 &&
      filesErrored.length === 0 ? (
        <div className="mt-6 rounded bg-green-900 p-4">
          ✅ Validation completed
          successfully.
        </div>
      ) : results.error_count > 0 ? (
        <div className="mt-6 rounded bg-red-900 p-4">
          ❌ {results.error_count} error
          {results.error_count === 1
            ? ""
            : "s"}{" "}
          must be resolved or
          acknowledged before export.
        </div>
      ) : results.issue_count > 0 ? (
        <div className="mt-6 rounded bg-yellow-900 p-4">
          ⚠ Advisory findings
          detected. Review
          recommended.
        </div>
      ) : null}

      {blockingReasons.length > 0 && (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) =>
              setAcknowledged(
                e.target.checked
              )
            }
          />
          I&apos;ve reviewed the{" "}
          {blockingReasons.join(
            " and "
          )}{" "}
          above and want to export
          anyway.
        </label>
      )}

      <button
        onClick={() =>
          setDetailsOpen(!detailsOpen)
        }
        className="mt-8 font-semibold"
      >
        {detailsOpen ? "▼" : "▶"} Validation
        Details
      </button>

      {detailsOpen && (
        <div className="mt-4 space-y-6">
          {results.issues.length === 0 ? (
            <p>No issues found.</p>
          ) : (
            <>
              {errors.length > 0 && (
                <div>
                  <h2 className="mb-2 text-lg font-semibold text-red-400">
                    Errors (
                    {errors.length})
                  </h2>

                  <ul className="space-y-4">
                    {errors.map(
                      (issue, index) => (
                        <IssueCard
                          key={`error-${index}`}
                          issue={issue}
                          sessionId={
                            sessionId
                          }
                          onCorrectionSaved={
                            handleCorrectionSaved
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
                </div>
              )}

              {warnings.length > 0 && (
                <div>
                  <h2 className="mb-2 text-lg font-semibold text-yellow-400">
                    Warnings (
                    {warnings.length})
                  </h2>

                  <ul className="space-y-4">
                    {warnings.map(
                      (issue, index) => (
                        <IssueCard
                          key={`warning-${index}`}
                          issue={issue}
                          sessionId={
                            sessionId
                          }
                          onCorrectionSaved={
                            handleCorrectionSaved
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
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
