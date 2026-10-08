/** One search hit's breadcrumb segments, relative to the configured
 * root -- e.g. ["Prairie Enterprises LLC", "Highway 20 Self Storage"]
 * for a facility match, or just ["Prairie Enterprises LLC"] for a
 * client-level one. Falls back to the bare name if `rootPath` hasn't
 * loaded yet (a brief race on first open), rather than showing nothing. */
export function breadcrumbFor(
  pathDisplay: string,
  rootPath: string | null
): string[] {
  if (!rootPath || !pathDisplay.startsWith(rootPath)) {
    return [pathDisplay.split("/").filter(Boolean).pop() ?? pathDisplay];
  }

  return pathDisplay
    .slice(rootPath.length)
    .split("/")
    .filter(Boolean);
}
