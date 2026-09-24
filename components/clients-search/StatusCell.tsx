/**
 * A person-derived match has no `status` -- getting one would need an
 * extra live PS call per candidate, deliberately skipped (see
 * `MatchedVia`'s own backend doc comment) -- but a bare "—" next to
 * real "Active" values on other rows reads as a rendering glitch, not
 * "we didn't check." Boris, 2026-09-08: label it explicitly instead.
 */
export function StatusCell({ status }: { status: string | null }) {
  if (status === null) {
    return (
      <span
        className="italic text-slate-600"
        title="Not checked -- this row was found via a person match, which skips a live per-candidate status lookup."
      >
        Unknown
      </span>
    );
  }
  return <span>{status}</span>;
}
