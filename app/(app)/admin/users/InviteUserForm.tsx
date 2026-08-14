"use client";

import { useState, type FormEvent } from "react";

import type { AuthResult } from "@/lib/auth-shared";
import {
  VALID_COMPANIES,
  type CreateInviteRequest,
  type InviteIssued,
  type Role,
  type RoleInfo,
} from "@/lib/auth-users";
import { inputClass, primaryButtonClass } from "./styles";

interface InviteUserFormProps {
  availableRoles: RoleInfo[] | null;
  onSubmit: (
    request: CreateInviteRequest
  ) => Promise<AuthResult<InviteIssued>>;
  /** Called once the invite is actually created -- the parent hides the
   * form and shows the issued-link banner; this component doesn't know
   * about either of those, only that its own job here is done. */
  onCreated: () => void;
}

/** The "Invite a user" form -- owns its own field state, submission-error
 * display, and default role selection. `role` starts empty; whenever it's
 * empty, the effective role is *derived* as the catalog's first entry
 * (once `availableRoles` has loaded) rather than synced into state via an
 * effect -- an effect that calls setState from its own body whenever a
 * dependency changes is exactly what the `react-hooks/set-state-in-effect`
 * rule flags, and there's a real derived value available here anyway. */
export default function InviteUserForm({
  availableRoles,
  onSubmit,
  onCreated,
}: InviteUserFormProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState<(typeof VALID_COMPANIES)[number]>(
    VALID_COMPANIES[0]
  );
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<Role>("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveRole = role || availableRoles?.[0]?.key || "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);

    const trimmedEmail = email.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedEmail || !trimmedFirst || !trimmedLast) return;

    setIsSubmitting(true);
    const result = await onSubmit({
      email: trimmedEmail,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      company,
      job_title: jobTitle.trim() || undefined,
      role: effectiveRole,
    });
    setIsSubmitting(false);

    if (result.kind !== "ok") {
      setCreateError(result.message);
      return;
    }

    setEmail("");
    setFirstName("");
    setLastName("");
    setJobTitle("");
    setRole("");
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-col gap-4 rounded border border-slate-800 bg-slate-900 p-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          First name
          <input
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Last name
          <input
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
          placeholder="name@quikstor.com"
        />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Company
          <select
            value={company}
            onChange={(event) =>
              setCompany(
                event.target.value as (typeof VALID_COMPANIES)[number]
              )
            }
            className={inputClass}
          >
            {VALID_COMPANIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Role
          <select
            value={effectiveRole}
            onChange={(event) => setRole(event.target.value)}
            className={inputClass}
          >
            {(availableRoles ?? []).map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Job title (optional)
          <input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      {createError && (
        <p role="alert" className="text-sm text-red-400">
          {createError}
        </p>
      )}

      <button
        type="submit"
        disabled={
          isSubmitting || !email.trim() || !firstName.trim() || !lastName.trim()
        }
        className={`${primaryButtonClass} self-start`}
      >
        {isSubmitting ? "Sending…" : "Create invite"}
      </button>
    </form>
  );
}
