"use client";

import { useState } from "react";

import { DropboxFolderPicker } from "@/components/clients/DropboxFolderPicker";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import { useClients } from "@/lib/clients";
import { getFacilityDropboxFolder } from "@/lib/dropbox";
import { useFileUploadAction } from "@/lib/useFileUploadAction";
import { useJsonPostAction } from "@/lib/useSessionAction";
import { stashTaggerCheck } from "@/lib/taggerReportCache";
import type { TaggerCheckResponse } from "@/types/api";

// The backend only ever reads word/document.xml out of the zip -- a
// .doc (legacy binary Word format) isn't a zip at all and won't parse,
// same scope cut already made for the rest of this tool.
const SUPPORTED_EXTENSIONS = [".docx"];

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

interface TaggerUploadPageProps {
  clientId: string;
  onChecked: (sessionId: string) => void;
}

export default function TaggerUploadPage({
  clientId,
  onChecked,
}: TaggerUploadPageProps) {
  const { getClient } = useClients();
  const client = getClient(clientId);

  // Mutually exclusive with `dropboxPath` below -- selecting one source
  // clears the other, same convention `DedupUploadPage` already uses.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dropboxPath, setDropboxPath] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Which of this client's own facilities to browse from -- see
  // DedupUploadPage's own comment: a company can have several
  // facilities, each with its own real Dropbox folder, so this can't be
  // guessed without an explicit pick.
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [facilityDropboxPath, setFacilityDropboxPath] = useState<
    string | null | undefined
  >(undefined);

  const { pending: loading, run } = useFileUploadAction("/tagger/check");
  const { pending: importing, run: runImportDropbox } = useJsonPostAction(
    "/tagger/import-dropbox"
  );

  const handleFacilitySelected = async (facilityName: string) => {
    setSelectedFacility(facilityName || null);
    setFacilityDropboxPath(undefined);

    if (!facilityName || !clientId) return;

    const result = await getFacilityDropboxFolder(clientId, facilityName);
    setFacilityDropboxPath(result.kind === "ok" ? result.data.path : null);
  };

  const handleFileSelection = (files: FileList | null) => {
    const file = files && files.length > 0 ? files[0] : null;

    setDropboxPath(null);

    if (file && !isSupportedFile(file)) {
      setSelectedFile(null);
      setApiError(
        `"${file.name}" isn't a supported file type — select a .docx file.`
      );
      return;
    }

    setSelectedFile(file);
    setApiError(null);
  };

  const handleDropboxPathSelected = (path: string) => {
    setSelectedFile(null);
    setApiError(null);
    setDropboxPath(path);
  };

  const finishChecked = (data: TaggerCheckResponse) => {
    // The results page (a moment away, via onChecked's navigation)
    // would otherwise re-fetch this exact candidate list over POST
    // /tagger/report -- stash it so useTaggerReport can use it
    // directly instead of a second round trip for data already in
    // hand.
    stashTaggerCheck(data);

    onChecked(data.session_id);
  };

  const handleCheck = async () => {
    if (dropboxPath) {
      setApiError(null);

      const result = await runImportDropbox({ path: dropboxPath });

      if (result.kind === "sessionExpired") {
        setApiError("Your session has expired — please try again.");
        return;
      }

      if (result.kind === "error") {
        setApiError(result.message);
        return;
      }

      finishChecked(await result.response.json());
      return;
    }

    if (!selectedFile) {
      setApiError("Please select a .docx file before continuing.");
      return;
    }

    setApiError(null);

    const formData = new FormData();
    formData.append("file", selectedFile, selectedFile.name);

    const result = await run(formData);

    if (result.kind === "sessionExpired") {
      setApiError("Your session has expired — please try again.");
      return;
    }

    if (result.kind === "error") {
      setApiError(result.message);
      return;
    }

    finishChecked(await result.response.json());
  };

  const hasSource = !!selectedFile || !!dropboxPath;
  const isChecking = loading || importing;

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold">QMS Template Tagger</h1>

      <h2 className="mb-4 text-xl font-semibold">Select a .docx Template</h2>

      <div className="rounded border border-slate-700 p-6">
        <input
          id="tagger-file-picker"
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => handleFileSelection(e.target.files)}
        />

        <label
          htmlFor="tagger-file-picker"
          className="inline-block cursor-pointer rounded bg-slate-700 px-4 py-2 transition-colors hover:bg-slate-600"
        >
          Select File
        </label>

        <div className="mt-4 text-sm text-slate-300">
          File Selected: <strong>{selectedFile ? selectedFile.name : "None"}</strong>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
            <DropboxLogo className="h-4 w-4 text-blue-400" />
            Or import from Dropbox
          </div>

          {client && client.facilityNames.length > 0 && (
            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-400">
                Which facility?
              </label>
              <select
                value={selectedFacility ?? ""}
                onChange={(e) => void handleFacilitySelected(e.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select a facility…</option>
                {client.facilityNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedFacility && facilityDropboxPath === undefined ? (
            // Waiting on the facility's own Dropbox folder to resolve --
            // rendering the picker already would open it at the root
            // for a moment before the real default arrives and corrects
            // it. Not rendering the picker at all until the answer is in
            // hand avoids that instead of just shortening it.
            <div className="text-sm text-slate-400">
              Locating this facility&apos;s Dropbox folder…
            </div>
          ) : (
            <DropboxFolderPicker
              value={dropboxPath ?? ""}
              mode="select-file"
              initialPath={facilityDropboxPath ?? client?.dropboxPath}
              onChange={handleDropboxPathSelected}
            />
          )}
        </div>

        <button
          onClick={handleCheck}
          disabled={isChecking || !hasSource}
          className="mt-6 rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          {isChecking
            ? dropboxPath
              ? "Importing & Recognizing..."
              : "Uploading & Recognizing..."
            : "Find Tags"}
        </button>
      </div>

      {apiError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">{apiError}</div>
      )}
    </div>
  );
}
