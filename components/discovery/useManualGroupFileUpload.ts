"use client";

import { useRef } from "react";
import { useFileUploadAction } from "@/lib/useFileUploadAction";
import type { DiscoverResponse } from "@/types/api";

interface UseManualGroupFileUploadArgs {
  sessionId: string;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
}

/**
 * The manual "browse for a file" path for the master group file -- a
 * hidden `<input type="file">` triggered programmatically, backed by the
 * shared `useFileUploadAction` hook (milestone 5). Pulled out of
 * `MasterGroupFileSection` so that component only has to wire up the
 * input element and the buttons that open it, not the upload mechanics
 * (building the FormData, translating a session-expired/error result,
 * forwarding the updated discovery).
 */
export function useManualGroupFileUpload({
  sessionId,
  onDiscoveryUpdated,
  onSessionExpired,
}: UseManualGroupFileUploadArgs) {
  const manualGroupFileInputRef = useRef<HTMLInputElement>(null);

  const {
    pending: manualGroupFileUploading,
    error: manualGroupFileError,
    run: runManualGroupFileUpload,
  } = useFileUploadAction("/group-file/upload");

  async function handleManualGroupFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !sessionId) return;

    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file, file.name);

    const result = await runManualGroupFileUpload(formData);

    if (result.kind === "sessionExpired") {
      onSessionExpired();
      return;
    }

    if (result.kind === "error") return;

    onDiscoveryUpdated(await result.response.json());
  }

  function openManualGroupFilePicker() {
    manualGroupFileInputRef.current?.click();
  }

  return {
    manualGroupFileInputRef,
    manualGroupFileUploading,
    manualGroupFileError,
    handleManualGroupFileChange,
    openManualGroupFilePicker,
  };
}
