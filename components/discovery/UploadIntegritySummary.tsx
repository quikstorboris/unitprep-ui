import type { UploadSummary } from "@/types/api";

interface UploadIntegritySummaryProps {
  uploadSummary: UploadSummary;
}

/**
 * DiscoveryPage's own "Upload Integrity Verification" box -- a pure
 * read of the `UploadSummary` the discover call returned, extracted
 * since it has no state or handlers of its own.
 */
export function UploadIntegritySummary({ uploadSummary }: UploadIntegritySummaryProps) {
  return (
    <div className="mt-6 rounded border border-slate-700 p-6">
      <h2 className="mb-4 text-xl font-semibold">Upload Integrity Verification</h2>

      <div className="space-y-2">
        <div>
          Files Selected: <strong>{uploadSummary.files_selected}</strong>
        </div>

        <div>
          Files Uploaded: <strong>{uploadSummary.files_uploaded}</strong>
        </div>

        <div>
          Files Failed: <strong>{uploadSummary.files_failed}</strong>
        </div>

        <div>
          Multipart Errors: <strong>{uploadSummary.multipart_errors}</strong>
        </div>
      </div>

      {uploadSummary.integrity_verified ? (
        <div className="mt-4 rounded bg-green-900 p-3 text-green-200">✅ Upload Integrity Verified</div>
      ) : (
        <div className="mt-4 rounded bg-yellow-900 p-3 text-yellow-200">⚠ Upload Integrity Check Failed</div>
      )}
    </div>
  );
}
