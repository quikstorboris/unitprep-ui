import { tryAuthFetch, type AuthResult } from "@/lib/auth-shared";

/** The one step-up-gated action that exists today -- mirrors
 * unitprep-api's `ADD_PASSKEY` constant. Kept here, not fetched from the
 * backend, for the same reason `VALID_COMPANIES` is a frontend constant:
 * there's exactly one of these, and a dedicated "list known step-up
 * actions" endpoint would be a lot of machinery for a list of one. */
export const KNOWN_STEP_UP_ACTIONS: { value: string; label: string }[] = [
  { value: "add_passkey", label: "Adding a new passkey to an already-enrolled account" },
];

export interface AuthConfiguration {
  step_up_actions: string[];
  updated_at: string;
  updated_by: string | null;
}

/** Org-wide auth policy -- currently just which actions require a fresh
 * step-up. `allowed_factors` exists in the schema but isn't surfaced
 * here: nothing in unitprep-api reads it yet, so a control for it would
 * edit a value with no effect on real behaviour. */
export async function getAuthConfiguration(): Promise<
  AuthResult<AuthConfiguration>
> {
  return tryAuthFetch("/auth/configuration", undefined, "GET");
}

export async function updateAuthConfiguration(
  stepUpActions: string[]
): Promise<AuthResult<{ step_up_actions: string[] }>> {
  return tryAuthFetch(
    "/auth/configuration",
    { step_up_actions: stepUpActions },
    "PUT"
  );
}
