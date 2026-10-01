"use client";

import { useRef, useState } from "react";

import { initialChecked } from "@/components/dedup/dedupChecklist";
import { isSupportedFile, sniffFileHeaders } from "@/lib/sniffFileHeaders";
import { useJsonPostAction } from "@/lib/useSessionAction";
import type { DedupClassifyFileInput, DedupClassifyResponse } from "@/types/api";

export type DedupSource = "local" | "dropbox";

/**
 * The supported files a folder/multi-file pick should be classified from.
 * A `webkitdirectory` pick also returns every nested subfolder's files;
 * only the picked folder's own files count (names stay unique that way).
 * Duplicate bare names from a multi-file pick keep the first.
 */
export function pickableFiles(list: FileList | File[] | null): File[] {
  const seen = new Set<string>();
  const out: File[] = [];

  for (const file of Array.from(list ?? [])) {
    if (!isSupportedFile(file)) continue;
    if ((file.webkitRelativePath ?? "").split("/").length > 2) continue;
    if (seen.has(file.name)) continue;
    seen.add(file.name);
    out.push(file);
  }

  return out;
}

export interface UseDedupFolderScanResult {
  source: DedupSource | null;
  localFiles: File[];
  dropboxFolder: string | null;
  classification: DedupClassifyResponse | null;
  checked: ReadonlySet<string>;
  scanning: boolean;
  error: string | null;
  scanLocal: (files: FileList | File[] | null) => void;
  scanDropboxFolder: (path: string) => void;
  toggle: (fileName: string) => void;
  selectAll: () => void;
  selectNone: () => void;
}

/**
 * Pick -> classify. Local picks are sniffed in the browser (header row
 * only) and only `{file_name, headers}` is sent; a Dropbox folder is
 * classified by the server, which downloads the files transiently.
 * Owns the checklist's ticked set, pre-seeded from `suggested.selected`.
 */
export function useDedupFolderScan(): UseDedupFolderScanResult {
  const [source, setSource] = useState<DedupSource | null>(null);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [dropboxFolder, setDropboxFolder] = useState<string | null>(null);
  const [classification, setClassification] = useState<DedupClassifyResponse | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { run: runClassifyFiles } = useJsonPostAction("/dedup/classify-files");
  const { run: runClassifyFolder } = useJsonPostAction("/dedup/classify-dropbox-folder");

  // A newer pick supersedes an older scan still in flight.
  const scanId = useRef(0);

  const begin = (nextSource: DedupSource) => {
    const id = ++scanId.current;
    setSource(nextSource);
    setClassification(null);
    setChecked(new Set());
    setError(null);
    setScanning(true);
    return id;
  };

  const finish = async (id: number, post: Promise<Awaited<ReturnType<typeof runClassifyFiles>>>) => {
    const result = await post;
    if (id !== scanId.current) return;

    setScanning(false);

    if (result.kind === "sessionExpired") {
      setError("Your session has expired — please try again.");
    } else if (result.kind === "error") {
      setError(result.message);
    } else if (result.kind === "ok") {
      const data: DedupClassifyResponse = await result.response.json();
      if (id !== scanId.current) return;
      setClassification(data);
      setChecked(initialChecked(data));
    }
  };

  const scanLocal = (list: FileList | File[] | null) => {
    const files = pickableFiles(list);
    const id = begin("local");
    setLocalFiles(files);
    setDropboxFolder(null);

    if (files.length === 0) {
      setScanning(false);
      setError(
        "No .csv, .xlsx, or .xls files were found directly in that selection."
      );
      return;
    }

    const classify = async () => {
      const inputs: DedupClassifyFileInput[] = await Promise.all(
        files.map(async (file) => ({
          file_name: file.name,
          headers: await sniffFileHeaders(file),
        }))
      );
      return runClassifyFiles({ files: inputs });
    };

    void finish(id, classify());
  };

  const scanDropboxFolder = (path: string) => {
    const id = begin("dropbox");
    setLocalFiles([]);
    setDropboxFolder(path);
    void finish(id, runClassifyFolder({ path }));
  };

  const toggle = (fileName: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(fileName)) next.add(fileName);
      return next;
    });

  const selectAll = () =>
    setChecked(new Set(classification?.files.map((f) => f.file_name) ?? []));

  const selectNone = () => setChecked(new Set());

  return {
    source,
    localFiles,
    dropboxFolder,
    classification,
    checked,
    scanning,
    error,
    scanLocal,
    scanDropboxFolder,
    toggle,
    selectAll,
    selectNone,
  };
}
