"use client";

import { useCurrentUser } from "@/lib/currentUser";
import { useClickUpConnection } from "@/lib/clickupConnection";

/**
 * The red/green dot beside the ClickUp nav entry: green when the
 * signed-in user's saved ClickUp token was accepted by ClickUp the last
 * time it was checked, red when nothing is saved or ClickUp rejected it,
 * grey while the first status read is still in flight (or failed) --
 * never a confident colour for a state that could not be confirmed.
 *
 * Rendered only inside a nav item that is itself gated on the
 * `integrations.clickup` permission, so the status fetch never fires for
 * a user who has no ClickUp access.
 */
export default function ClickUpStatusDot() {
  const { user } = useCurrentUser();
  const { connection, loaded } = useClickUpConnection(user?.user_id ?? null);

  let colour = "bg-slate-600";
  let label = "ClickUp status unknown";

  if (loaded && connection) {
    if (connection.status === "connected") {
      colour = "bg-green-500";
      label = "ClickUp connected";
    } else if (connection.status === "invalid") {
      colour = "bg-red-500";
      label = "ClickUp token rejected";
    } else {
      colour = "bg-red-500";
      label = "ClickUp not connected";
    }
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`ml-2 inline-block h-2 w-2 shrink-0 rounded-full ${colour}`}
    />
  );
}
