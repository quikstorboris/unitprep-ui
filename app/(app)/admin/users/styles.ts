// Shared Tailwind class strings for the admin Users page and its
// co-located InviteUserForm/UserRow components -- kept in one place so
// the three files agree on button/input styling without each re-typing
// (and risking drift on) the same literal strings. Mirrors the same
// pattern already used by admin/client-ops/qms-tags.

export const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClass =
  "rounded bg-red-900 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

export const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

export const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";
