export default function EntityCell({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string | null;
}) {
  return (
    <div className="text-xs">
      <div className="text-slate-300">{entityType}</div>
      {entityId && <div className="font-mono text-slate-600">{entityId}</div>}
    </div>
  );
}
