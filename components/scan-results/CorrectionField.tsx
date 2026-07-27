"use client";
import { useState } from "react";

import { useSessionAction } from "@/lib/useSessionAction";
import type { ValidateResponse } from "@/types/api";

interface CorrectionFieldProps {
  sessionId: string;
  fileName: string;
  unitNumber: string;
  field: string;
  onSaved: (result: ValidateResponse) => void;
  onSessionExpired: () => void;
}

export function CorrectionField({
  sessionId,
  fileName,
  unitNumber,
  field,
  onSaved,
  onSessionExpired,
}: CorrectionFieldProps) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const {
    pending: saving,
    error,
    run,
  } = useSessionAction(
    sessionId,
    "/correct"
  );

  const handleSave = async () => {
    if (!value.trim()) return;

    const result = await run({
      file_name: fileName,
      unit_number: unitNumber,
      field,
      value,
    });

    if (result.kind === "sessionExpired") {
      onSessionExpired();
      return;
    }

    if (result.kind === "error") {
      return;
    }

    const data: ValidateResponse =
      await result.response.json();

    setSaved(true);
    onSaved(data);
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
