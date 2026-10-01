"use client";

import type { MissingLegalOwner } from "@/lib/clientsDetail";
import { candidateKey } from "./personRoster";

interface MissingLegalOwnersSectionProps {
  owners: MissingLegalOwner[];
  pendingKey: string | null;
  actionError: string | null;
  onAdd: (owner: MissingLegalOwner) => void;
}

/**
 * Owners listed on the Merchant Account Pre-App with no roster row and
 * no Intake "Add User" chip either -- otherwise invisible on this tab.
 * Real case this exists for (Freeland Warehousing & Storage,
 * 2026-09-30): the Pre-App lists two 50% owners, but Intake's own
 * "Owner Level Users" text only ever named one of them, so the other
 * had no roster row and no candidate to be found by. See
 * `clients::legal_owner::unmatched_owners`'s own doc comment for why
 * this list can never duplicate someone the roster or the Intake
 * candidates above already cover.
 *
 * Adding one always defaults their Access Level to Owner -- that's a
 * QMS access-level guess, not a re-statement of their Pre-App ownership
 * percentage, so change it afterward from the roster's own Edit action
 * if it's wrong for this person.
 */
export function MissingLegalOwnersSection({ owners, pendingKey, actionError, onAdd }: MissingLegalOwnersSectionProps) {
  if (owners.length === 0) return null;

  return (
    <section className="rounded border border-amber-900/60 bg-amber-950/10 p-5">
      <h2 className="mb-2 text-lg font-semibold text-amber-200">Legal Owners Not Yet on This Roster</h2>
      <p className="mb-4 text-sm text-slate-400">
        Listed as an owner on the Merchant Account Pre-App, but not named anywhere on this facility&apos;s own
        Intake form -- so there&apos;s no &quot;Add User&quot; chip for them below. Adding one sets their Access
        Level to Owner; change it afterward from the roster&apos;s own Edit action if that&apos;s wrong.
      </p>
      <div className="flex flex-wrap gap-2">
        {owners.map((owner) => {
          const key = candidateKey({ full_name: owner.full_name, email: owner.email, role: "owner" });

          return (
            <button
              key={key}
              type="button"
              onClick={() => onAdd(owner)}
              disabled={pendingKey === key}
              title={owner.email ?? undefined}
              className="rounded-full border border-amber-700 bg-amber-900/20 px-3 py-1.5 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + {owner.full_name}
            </button>
          );
        })}
      </div>
      {actionError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {actionError}
        </p>
      )}
    </section>
  );
}
