"use client";

import { useState } from "react";
import SessionExpiredPage from "@/components/SessionExpiredPage";
import { DiscoveryResultsSection } from "@/components/discovery/DiscoveryResultsSection";
import { SourceFolderSection } from "@/components/discovery/SourceFolderSection";
import { UploadIntegritySummary } from "@/components/discovery/UploadIntegritySummary";
import { useClients } from "@/lib/clients";
import type {
  DiscoverResponse,
  UploadSummary,
} from "@/types/api";

interface DiscoveryPageProps {
  clientId: string;
  selectedFiles: FileList | null;
  dropboxPath: string | null;
  sessionId: string;
  discovery: DiscoverResponse | null;
  uploadSummary: UploadSummary | null;
  loading: boolean;
  apiError: string | null;
  /** True once onCancel() has fired for the upload/discover pipeline
   * currently (or most recently) in flight -- see useAbortableOperation. */
  cancelled: boolean;
  /** Milliseconds elapsed since the current/last upload/discover
   * pipeline started. */
  elapsedMs: number;
  /** Aborts whichever request (upload or discover) is currently in
   * flight. */
  onCancel: () => void;

  onFileSelection: (
    files: FileList | null
  ) => void;

  onDropboxPathSelected: (path: string) => void;

  onDiscover: () => void;

  onDiscoveryUpdated: (
    discovery: DiscoverResponse
  ) => void;

  onScan: () => void;

  onBack: () => void;

  onSessionExpired: () => void;
}

export default function DiscoveryPage({
  clientId,
  selectedFiles,
  dropboxPath,
  sessionId,
  discovery,
  uploadSummary,
  loading,
  apiError,
  cancelled,
  elapsedMs,
  onCancel,
  onFileSelection,
  onDropboxPathSelected,
  onDiscover,
  onDiscoveryUpdated,
  onScan,
  onBack,
  onSessionExpired,
}: DiscoveryPageProps) {
  const { getClient } = useClients();
  const client = getClient(clientId);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  const handleSessionExpired = () =>
    setSessionExpired(true);

  if (sessionExpired) {
    return (
      <SessionExpiredPage
        onHome={onSessionExpired}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl text-slate-100">
      <div className="mb-6 flex gap-4">
        <button
          onClick={onBack}
          className="rounded bg-slate-700 px-4 py-2"
        >
          ← Back
        </button>
      </div>

      <h1 className="mb-8 text-4xl font-bold">
        UnitPrep
      </h1>

      <h2 className="mb-4 text-xl font-semibold">
        Select Source Folder
      </h2>

      <SourceFolderSection
        clientId={clientId}
        client={client}
        selectedFiles={selectedFiles}
        dropboxPath={dropboxPath}
        sessionId={sessionId}
        loading={loading}
        elapsedMs={elapsedMs}
        onCancel={onCancel}
        onFileSelection={onFileSelection}
        onDropboxPathSelected={onDropboxPathSelected}
        onDiscover={onDiscover}
      />

      {uploadSummary && (
        <UploadIntegritySummary uploadSummary={uploadSummary} />
      )}

      {apiError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">
          {apiError}
        </div>
      )}

      {cancelled && !loading && !uploadSummary && (
        <div className="mt-4 rounded bg-amber-900 p-3 text-amber-200">
          Upload/discovery cancelled.
        </div>
      )}

      {discovery && (
        <DiscoveryResultsSection
          sessionId={sessionId}
          discovery={discovery}
          uploadSummary={uploadSummary}
          onDiscoveryUpdated={onDiscoveryUpdated}
          onScan={onScan}
          onSessionExpired={handleSessionExpired}
        />
      )}
    </div>
  );
}
