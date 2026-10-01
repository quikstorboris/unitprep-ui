import { formatPhone } from "@/lib/format";
import type { FacilityPerson, PersonAssignment } from "@/lib/clientsDetail";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  district_manager: "District Manager",
  manager: "Manager",
};

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** "Laura Cathryn Grace" -> { last: "grace", first: "laura cathryn" }.
 * The last word is the surname, ignoring a trailing generational suffix
 * ("Jr.", "III"); a single word is treated as a surname with no first
 * name. Lowercased for comparison only. */
function nameParts(fullName: string): { last: string; first: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && NAME_SUFFIXES.has(words[words.length - 1].toLowerCase().replace(/\./g, ""))) {
    words.pop();
  }
  const last = (words.pop() ?? "").toLowerCase();
  return { last, first: words.join(" ").toLowerCase() };
}

/**
 * The roster's display order: legal owners first, then everyone else;
 * within each group alphabetical by last name, then first name. The
 * server's own order is just by full name (i.e. first name), so this
 * runs once on load and also drives "Copy All".
 */
export function sortRoster(roster: FacilityPerson[]): FacilityPerson[] {
  return [...roster].sort((a, b) => {
    if (a.legal_owner !== b.legal_owner) return a.legal_owner ? -1 : 1;
    const nameA = nameParts(a.full_name);
    const nameB = nameParts(b.full_name);
    return (
      nameA.last.localeCompare(nameB.last) ||
      nameA.first.localeCompare(nameB.first) ||
      a.full_name.localeCompare(b.full_name)
    );
  });
}

export const SOURCE_LABELS: Record<string, string> = {
  process_street: "Process Street",
  manual: "Manual",
};

/** Section heading per role, in the fixed order Boris asked for --
 * Owner(s), District Manager(s), Manager(s) -- not alphabetical or
 * table order, and skipped entirely when this facility has none of
 * that role. */
const ROLE_CLIPBOARD_HEADINGS: { role: string; heading: string }[] = [
  { role: "owner", heading: "Owner(s):" },
  { role: "district_manager", heading: "District Manager(s):" },
  { role: "manager", heading: "Manager(s):" },
];

/**
 * Formats the roster for "Copy All" -- one person per paragraph, name
 * then phone then email (each only if present), blank line between
 * people. Plain text, not CSV/markdown -- meant to be pasted straight
 * into an email or a PS field, not parsed back.
 */
export function formatRosterForClipboard(roster: FacilityPerson[]): string {
  return ROLE_CLIPBOARD_HEADINGS.filter(({ role }) => roster.some((person) => person.role === role))
    .map(({ role, heading }) => {
      const people = roster
        .filter((person) => person.role === role)
        .map((person) =>
          [person.full_name, person.phone ? formatPhone(person.phone) : null, person.email]
            .filter((line): line is string => !!line)
            .join("\n")
        )
        .join("\n\n");
      return `${heading}\n\n${people}`;
    })
    .join("\n\n\n");
}

export interface PersonFormState {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

export function emptyPersonForm(): PersonFormState {
  return { full_name: "", email: "", phone: "", role: "manager" };
}

export function personFormToAssignment(form: PersonFormState): PersonAssignment {
  return {
    full_name: form.full_name,
    email: form.email.trim() === "" ? null : form.email,
    phone: form.phone.trim() === "" ? null : form.phone,
    role: form.role,
  };
}

/**
 * 2026-09-08: "already linked" is matched by (email, role, full_name),
 * not just (email, role) -- real Dubuqueland data has several distinct
 * people (Barb Soppe, Carrie Krueger, Chad Soppe) sharing one family
 * inbox with the same role. Matching without name collapsed them: once
 * one was linked, the others' chips showed red too even though they
 * weren't on the roster, and clicking one would have unlinked the wrong
 * person (whoever the email+role match actually resolved to).
 */
export function candidateKey(person: { full_name: string; email: string | null; role: string }): string {
  return `${(person.email ?? "").toLowerCase()}:${person.role}:${person.full_name.trim().toLowerCase()}`;
}
