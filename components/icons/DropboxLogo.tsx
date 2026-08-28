/**
 * A minimal recreation of the Dropbox glyph -- two "wing" diamonds
 * meeting a third below, the same silhouette the real logo uses.
 * Not the trademarked asset, just a recognizable stand-in for marking
 * Dropbox-sourced UI (currently "Source Files"; the future DrBx tab
 * will want the same marker).
 */
export function DropboxLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <polygon points="7,3 12,6.5 7,10 2,6.5" />
      <polygon points="17,3 22,6.5 17,10 12,6.5" />
      <polygon points="7,11.5 12,15 7,18.5 2,15" />
      <polygon points="17,11.5 22,15 17,18.5 12,15" />
      <polygon points="7,19.5 12,16 17,19.5 12,23" />
    </svg>
  );
}
