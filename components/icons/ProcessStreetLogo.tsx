/**
 * A minimal recreation of the Process Street mark -- a rounded blue
 * square with a white diagonal flag/arrow -- the same idea
 * `DropboxLogo` already uses for Dropbox: not the trademarked asset,
 * just a recognizable stand-in for marking Process Street-sourced UI
 * (currently the search-loading interstitial).
 */
export function ProcessStreetLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#2F6FED" />
      <path d="M7 17 15 7h4l-8 10z" fill="#fff" />
      <path d="M7 17h4l8-10h-4z" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}
