"use client";

/**
 * The Review & Create screen's ClickUp card. Every client is expected to
 * have a ClickUp list per facility, so by default Create hands the user
 * to the Link ClickUp dialog right afterwards; ticking the box is the
 * deliberate "this client has no ClickUp project" opt-out.
 *
 * A user without the ClickUp permission cannot link anything, so for them
 * this only explains that someone with access will need to.
 */
export function ClickUpChoice({
  waived,
  onChange,
  canLink,
}: {
  waived: boolean;
  onChange: (waived: boolean) => void;
  canLink: boolean;
}) {
  return (
    <section className="rounded border border-slate-800 p-5">
      <h2 className="mb-2 text-lg font-semibold">ClickUp</h2>

      <p className="mb-3 text-sm text-slate-400">
        {canLink
          ? "After Create, you'll link each facility to its ClickUp list."
          : "You don't have ClickUp access, so this client will need its ClickUp lists linked by someone who does."}
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={waived}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        Create without ClickUp project
      </label>
    </section>
  );
}
