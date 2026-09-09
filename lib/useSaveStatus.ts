"use client";

import { useState } from "react";

interface SaveOutcome<T> {
  kind: string;
  data?: T;
  message?: string;
}

interface UseSaveStatusResult<T> {
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  /**
   * Runs `action`, tracking saving/saved/saveError around it -- the same
   * setSaving(true)/setSaveError(null)/setSaved(false) -> await ->
   * setSaving(false) -> branch-on-`kind` dance that
   * `integrations/dropbox`, `integrations/process-street`, and
   * `admin/security-policies` each separately wrote (2026-09-09).
   * Returns the saved `data` on success, `null` on failure -- the caller
   * still owns updating its own local state from that value.
   */
  runSave: (action: () => Promise<SaveOutcome<T>>) => Promise<T | null>;
  /**
   * Clears the "Saved." confirmation -- call from any handler that
   * changes the form after a save, so a stale confirmation doesn't
   * linger next to an edited-but-not-yet-saved field.
   */
  clearSaved: () => void;
}

/**
 * A settings page's whole load-then-edit-in-place-then-save flow shares
 * one shape across every one of this app's admin settings pages: no
 * separate "editing" toggle (the form is always live), just
 * saving/saved/saveError bookkeeping around one save call. Distinct from
 * `useSessionAction`, which is fetch-plumbing for the unit-group-session
 * "click a button, POST {session_id}" family -- this wraps any already-
 * typed save function (`updateDropboxSettings`, `updateAuthConfiguration`,
 * ...) that returns the app's standard `{kind: "ok", data} | {kind, message}`
 * result shape.
 */
export function useSaveStatus<T>(): UseSaveStatusResult<T> {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function runSave(action: () => Promise<SaveOutcome<T>>): Promise<T | null> {
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const result = await action();
    setSaving(false);

    if (result.kind !== "ok") {
      setSaveError(result.message ?? "Save failed.");
      return null;
    }

    setSaved(true);
    return result.data ?? null;
  }

  function clearSaved() {
    setSaved(false);
  }

  return { saving, saved, saveError, runSave, clearSaved };
}
