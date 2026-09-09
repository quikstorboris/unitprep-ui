import type { UserSummary } from "@/lib/auth-users";

/**
 * Resolves a UUID to "Name (email)" via a client-side lookup against the
 * already-fetched Users list -- no backend change needed for this: an
 * admin who can see the security log can already see the full Users
 * list (same role gate), so this exposes nothing they didn't already
 * have access to. Falls back to `null` (render just the UUID) for an
 * actor/target who no longer appears in that list, e.g. a soft-deleted
 * user.
 */
function resolvedUserLabel(
  userId: string | null,
  usersById: Map<string, UserSummary>
): string | null {
  if (!userId) return null;
  const user = usersById.get(userId);
  if (!user) return null;
  return `${user.first_name} ${user.last_name} (${user.email})`;
}

/** One cell's worth of actor/target rendering: resolved name+email on top,
 * the UUID underneath in smaller, muted text -- kept visible rather than
 * replaced, since it's the durable identifier if a user is later renamed
 * or removed. */
export default function UserCell({
  userId,
  usersById,
}: {
  userId: string | null;
  usersById: Map<string, UserSummary>;
}) {
  if (!userId) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const label = resolvedUserLabel(userId, usersById);

  return (
    <div className="text-xs">
      {label && <div className="text-slate-300">{label}</div>}
      <div className="font-mono text-slate-600">{userId}</div>
    </div>
  );
}
