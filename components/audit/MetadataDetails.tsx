/**
 * Collapsible raw-metadata dump for a log row -- renders nothing when
 * metadata is empty, since an occurrence with no extra fields shouldn't
 * show an empty disclosure triangle.
 */
export default function MetadataDetails({
  metadata,
  className,
}: {
  metadata: Record<string, unknown> | null;
  className?: string;
}) {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  return (
    <details className={className}>
      <summary className="cursor-pointer text-slate-500 hover:text-slate-300">
        metadata
      </summary>
      <pre className="mt-1 whitespace-pre-wrap break-all text-slate-500">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </details>
  );
}
