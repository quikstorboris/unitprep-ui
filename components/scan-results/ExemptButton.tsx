"use client";
import { useSessionAction } from "@/lib/useSessionAction";
import type { ValidateResponse } from "@/types/api";

interface ExemptButtonProps {
  sessionId: string;
  fileName: string;
  unitNumber: string;
  onExempted: (
    result: ValidateResponse
  ) => void;
  onSessionExpired: () => void;
}

export function ExemptButton({
  sessionId,
  fileName,
  unitNumber,
  onExempted,
  onSessionExpired,
}: ExemptButtonProps) {
  const {
    pending: saving,
    error,
    run,
  } = useSessionAction(
    sessionId,
    "/exempt-dimensions"
  );

  const handleExempt = async () => {
    const result = await run({
      file_name: fileName,
      unit_number: unitNumber,
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

    onExempted(data);
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
