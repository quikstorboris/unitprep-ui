"use client";

import { useState } from "react";

import type { ConfirmedSubstitution } from "@/types/api";

interface Options {
  /** Whether Apply/Save should ask "preserve underscores or not" first --
   * only a real question when the document actually has a blank to
   * preserve. A document with none never shows the dialog and just runs
   * outright. */
  hasBlankCandidates: boolean;
  confirmedSubstitutions: () => ConfirmedSubstitution[];
  defaultFolderPath: string | null | undefined;
  handleApply: (substitutions: ConfirmedSubstitution[], preserve: boolean) => void;
  handleSave: (
    substitutions: ConfirmedSubstitution[],
    preserve: boolean,
    folderPath: string
  ) => void;
}

/**
 * Download and Save to Facility Folder share one "preserve blanks?"
 * dialog (a document-level question, not per-action), so this remembers
 * which action the dialog is gating and runs it once the reviewer
 * answers.
 */
export function usePreserveBlanksGate({
  hasBlankCandidates,
  confirmedSubstitutions,
  defaultFolderPath,
  handleApply,
  handleSave,
}: Options) {
  const [showPreserveDialog, setShowPreserveDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"download" | "save" | null>(
    null
  );

  function handleApplyClick() {
    if (hasBlankCandidates) {
      setPendingAction("download");
      setShowPreserveDialog(true);
      return;
    }
    handleApply(confirmedSubstitutions(), false);
  }

  function handleSaveClick() {
    if (!defaultFolderPath) return;
    if (hasBlankCandidates) {
      setPendingAction("save");
      setShowPreserveDialog(true);
      return;
    }
    handleSave(confirmedSubstitutions(), false, defaultFolderPath);
  }

  function handlePreserveChoice(preserve: boolean) {
    setShowPreserveDialog(false);
    if (pendingAction === "save") {
      if (defaultFolderPath) {
        handleSave(confirmedSubstitutions(), preserve, defaultFolderPath);
      }
    } else {
      handleApply(confirmedSubstitutions(), preserve);
    }
    setPendingAction(null);
  }

  return {
    showPreserveDialog,
    closePreserveDialog: () => setShowPreserveDialog(false),
    handleApplyClick,
    handleSaveClick,
    handlePreserveChoice,
  };
}
