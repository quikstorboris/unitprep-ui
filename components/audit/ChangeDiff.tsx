/**
 * Before/after diffing for the change-type events (`user_deactivated`,
 * `account_recovery_initiated`, and any future `role_changed`/
 * `auth_configuration_updated`) -- red for what a field held, green for
 * what it holds now. Most events carry neither and this renders nothing
 * for them, which is deliberate: an occurrence is not a transition.
 */
export default function ChangeDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;

  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  );

  return (
    <dl className="flex flex-col gap-0.5">
      {keys.map((key) => {
        const beforeValue = before?.[key];
        const afterValue = after?.[key];

        return (
          <div key={key} className="flex gap-2">
            <dt className="text-slate-500">{key}:</dt>
            <dd>
              {before && (
                <span className="text-red-400 line-through">
                  {String(beforeValue)}
                </span>
              )}
              {before && after && (
                <span className="mx-1 text-slate-600">→</span>
              )}
              {after && (
                <span className="text-green-400">{String(afterValue)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
