/** All selected means no filter at all -- an explicit event_type list
 * matching every known value would behave the same on the backend, but
 * omitting it keeps the request from silently excluding a brand-new
 * event type added to the backend after the canonical list was fetched.
 * Shared by both log domains' inline and export pages -- same filter
 * query shape on both backends. */
export function resolveEventTypeFilter(
  selected: string[],
  all: string[]
): string[] | undefined {
  return selected.length === all.length ? undefined : selected;
}
