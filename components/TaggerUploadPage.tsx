"use client";

import { useState } from "react";

import { API_URL, errorMessageFrom } from "@/lib/api";
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
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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

    try {
      setLoading(true);
      setApiError(null);

      const formData = new FormData();
      formData.append("file", selectedFile, selectedFile.name);

      const response = await fetch(`${API_URL}/tagger/check`, {
        method: "POST",
        // The API is a different origin (different port), so cookies
        // are withheld unless this is explicit -- without it, every
        // request looks signed-out regardless of a valid session.
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await errorMessageFrom(response));
      }

      const data: TaggerCheckResponse = await response.json();

      // The results page (a moment away, via onChecked's navigation)
      // would otherwise re-fetch this exact candidate list over POST
      // /tagger/report -- stash it so useTaggerReport can use it
      // directly instead of a second round trip for data already in
      // hand.
      stashTaggerCheck(data);

      onChecked(data.session_id);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
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
