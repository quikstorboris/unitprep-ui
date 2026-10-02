"use client";

import { hasPermission } from "@/lib/auth-session";
import { useCurrentUser } from "@/lib/currentUser";

/**
 * Whether the signed-in user has been granted ClickUp
 * (`integrations.clickup`). Gates the link/unlink buttons; the link
 * itself is shown to anyone.
 */
export function useClickUpAccess(): { allowed: boolean } {
  const { user } = useCurrentUser();
  return { allowed: hasPermission(user, "integrations.clickup") };
}
