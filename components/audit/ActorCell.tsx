import type { UserSummary } from "@/lib/auth-users";

/** Same reasoning as Security Logs' own `UserCell`: an actor who can see
 * this page can already see the full Users list (same role gate), so
 * this exposes nothing new. `null` (render just the UUID) for an actor
 * no longer in that list -- or the `System` placeholder used by a
 * scheduled sync's own actor id, which never appears in Users at all. */
function resolvedActorLabel(
  userId: string | null,
  usersById: Map<string, UserSummary>
): string | null {
  if (!userId) return null;
  if (userId === "00000000-0000-0000-0000-000000000000") {
    return "System (scheduled sync)";
  }
  const user = usersById.get(userId);
  if (!user) return null;
  return `${user.first_name} ${user.last_name} (${user.email})`;
}

export default function ActorCell({
  userId,
  usersById,
}: {
  userId: string | null;
  usersById: Map<string, UserSummary>;
}) {
  if (!userId) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const label = resolvedActorLabel(userId, usersById);

  return (
    <div className="text-xs">
      {label && <div className="text-slate-300">{label}</div>}
      <div className="font-mono text-slate-600">{userId}</div>
    </div>
  );
}
