"use client";

import { useState } from "react";

import { useFileUploadAction } from "@/lib/useFileUploadAction";
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
  onChecked: (sessionId: string) => void;
}

export default function TaggerUploadPage({
  onChecked,
}: TaggerUploadPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { pending: loading, run } = useFileUploadAction("/tagger/check");

  const handleFileSelection = (files: FileList | null) => {
    const file = files && files.length > 0 ? files[0] : null;

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

  const handleCheck = async () => {
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

    const data: TaggerCheckResponse = await result.response.json();

    // The results page (a moment away, via onChecked's navigation)
    // would otherwise re-fetch this exact candidate list over POST
    // /tagger/report -- stash it so useTaggerReport can use it
    // directly instead of a second round trip for data already in
    // hand.
    stashTaggerCheck(data);

    onChecked(data.session_id);
  };

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

        <button
          onClick={handleCheck}
          disabled={loading || !selectedFile}
          className="mt-6 rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Uploading & Recognizing..." : "Find Tags"}
        </button>
      </div>

      {apiError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">{apiError}</div>
      )}
    </div>
  );
}
