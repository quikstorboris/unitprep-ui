"use client";

import { useRef } from "react";
import { useFileUploadAction } from "@/lib/useFileUploadAction";
import type { DiscoverResponse } from "@/types/api";

interface UseManualUnitFileUploadArgs {
  sessionId: string;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
}

/**
 * The manual "browse for a file" path for a unit file that didn't
 * auto-classify -- a net-new facility's own export, whose columns don't
 * match any registered vendor signature. Mirrors
 * `useManualGroupFileUpload`: a hidden `<input type="file">` triggered
 * programmatically, backed by the shared `useFileUploadAction` hook. The
 * forced file then goes through the same manual column-mapping step
 * (`/unit-file/resolve-format`) any other unresolved unit file does.
 */
export function useManualUnitFileUpload({
  sessionId,
  onDiscoveryUpdated,
  onSessionExpired,
}: UseManualUnitFileUploadArgs) {
  const manualUnitFileInputRef = useRef<HTMLInputElement>(null);

  const {
    pending: manualUnitFileUploading,
    error: manualUnitFileError,
    run: runManualUnitFileUpload,
  } = useFileUploadAction("/unit-file/upload");

  async function handleManualUnitFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !sessionId) return;

    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file, file.name);

    const result = await runManualUnitFileUpload(formData);

    if (result.kind === "sessionExpired") {
      onSessionExpired();
      return;
    }

    if (result.kind === "error") return;

    onDiscoveryUpdated(await result.response.json());
  }

  function openManualUnitFilePicker() {
    manualUnitFileInputRef.current?.click();
  }

  return {
    manualUnitFileInputRef,
    manualUnitFileUploading,
    manualUnitFileError,
    handleManualUnitFileChange,
    openManualUnitFilePicker,
  };
}
