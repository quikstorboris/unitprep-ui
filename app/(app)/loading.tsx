/**
 * Shown in the page area while a signed-in page's code is still arriving
 * (the first visit to a screen downloads its chunk). The nav stays put; this
 * only replaces what would otherwise be an empty pane.
 */
export default function Loading() {
  return (
    <div className="p-8">
      <p className="text-sm text-slate-400">Loading…</p>
    </div>
  );
}
