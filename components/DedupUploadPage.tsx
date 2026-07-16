"use client";

import { useState } from "react";

import { API_URL, errorMessageFrom } from "@/lib/api";
import type { DedupCheckResponse } from "@/types/api";

interface DedupUploadPageProps {
  onChecked: (sessionId: string) => void;
}

export default function DedupUploadPage({
  onChecked,
}: DedupUploadPageProps) {
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [apiError, setApiError] =
    useState<string | null>(null);

  const handleFileSelection = (
    files: FileList | null
  ) => {
    setSelectedFile(
      files && files.length > 0
        ? files[0]
        : null
    );

    setApiError(null);
  };

  const handleCheck = async () => {
    if (!selectedFile) {
      setApiError(
        "Please select a CSV file before continuing."
      );

      return;
    }

    try {
      setLoading(true);
      setApiError(null);

      const formData = new FormData();

      formData.append(
        "file",
        selectedFile,
        selectedFile.name
      );

      const response = await fetch(
        `${API_URL}/dedup/check`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const data: DedupCheckResponse =
        await response.json();

      onChecked(data.session_id);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold">
        Duplicate Tenant Check
      </h1>

      <h2 className="mb-4 text-xl font-semibold">
        Select QMS End Users Export
      </h2>

      <div className="rounded border border-slate-700 p-6">
        <input
          id="dedup-file-picker"
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) =>
            handleFileSelection(
              e.target.files
            )
          }
        />

        <label
          htmlFor="dedup-file-picker"
          className="inline-block cursor-pointer rounded bg-slate-700 px-4 py-2 transition-colors hover:bg-slate-600"
        >
          Select File
        </label>

        <div className="mt-4 text-sm text-slate-300">
          File Selected:{" "}
          <strong>
            {selectedFile
              ? selectedFile.name
              : "None"}
          </strong>
        </div>

        <button
          onClick={handleCheck}
          disabled={
            loading || !selectedFile
          }
          className="mt-6 rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          {loading
            ? "Uploading & Checking..."
            : "Run Check"}
        </button>
      </div>

      {apiError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">
          {apiError}
        </div>
      )}
    </div>
  );
}
