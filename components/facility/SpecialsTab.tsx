"use client";

import { useEffect, useRef, useState } from "react";

import { updateFacilitySpecials } from "@/lib/clientsDetail";

import { ManuallyMaintainedNote, PolicySectionHeader, QsxEmptyBanner, type PolicyTabProps } from "./PolicyTabShared";

/** Grows a textarea to fit its own content -- reset to "auto" first so
 * a shrink (text deleted, or a fresh shorter value loaded in) actually
 * shrinks the box instead of only ever growing from whatever height it
 * last settled at. */
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function SpecialsTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEmpty = !policies.specials_raw_text;

  // Sizes to whatever's already there the moment the textarea appears
  // (a long pasted block shouldn't start scrolled/clipped) -- the
  // `onChange` handler below covers every edit after that.
  useEffect(() => {
    if (editing) autoResizeTextarea(textareaRef.current);
  }, [editing]);

  function startEdit() {
    setRawText(policies.specials_raw_text ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const result = await updateFacilitySpecials(companyId, facilityId, rawText.trim() === "" ? null : rawText);

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setEditing(false);
    await onSaved();
  }

  return (
    <div className="rounded border border-slate-800 p-5">
      <PolicySectionHeader
        title="Specials"
        editing={editing}
        saving={saving}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
        onSave={save}
      />

      {policies.specials_manually_exempt && <ManuallyMaintainedNote />}
      {!editing && isEmpty && policies.is_qsx_legacy && <QsxEmptyBanner category="specials" />}

      {!editing ? (
        isEmpty ? (
          <p className="text-sm text-slate-500">No specials captured for this facility yet.</p>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-slate-200">{policies.specials_raw_text}</pre>
        )
      ) : (
        <textarea
          ref={textareaRef}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            autoResizeTextarea(e.target);
          }}
          className="min-h-[14rem] w-full resize-none overflow-hidden rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
