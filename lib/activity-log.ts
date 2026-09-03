import {
  fetchForDownload,
  tryAuthFetch,
  type AuthResult,
  type FileDownloadResult,
} from "@/lib/auth-shared";

/**
 * Client-ops operations trail (imports, dedup/Unit Group runs, Process
 * Street syncs) -- distinct from `auth-audit.ts`'s security audit trail.
 * Mirrors that file's shape closely (same keyset-pagination idiom, same
 * export/preview split) but is not literally shared with it: the
 * backend tables differ in exactly the ways that make a shared type not
 * worth it -- `id` is a time-ordered UUID here, not a bigint, and rows
 * are identified by `entity_type`/`entity_id` rather than an actor/
 * target user pair. See `client_ops_activity_logs`'s own module doc.
 */
export interface ActivityLogEntry {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityLogFilters {
  limit?: number;
  /** Keyset pagination: only entries older than this one's id (a
   * time-ordered UUID) -- pass the last entry's `id` from the previous
   * page to fetch the next. */
  beforeId?: string;
  eventType?: string;
  entityType?: string;
  actorUserId?: string;
}

export async function listActivityLogs(
  filters: ActivityLogFilters = {}
): Promise<AuthResult<{ entries: ActivityLogEntry[] }>> {
  const params = new URLSearchParams();
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.beforeId !== undefined) params.set("before_id", filters.beforeId);
  if (filters.eventType) params.set("event_type", filters.eventType);
  if (filters.entityType) params.set("entity_type", filters.entityType);
  if (filters.actorUserId) params.set("actor_user_id", filters.actorUserId);

  const query = params.toString();
  return tryAuthFetch(
    `/client-ops/activity-logs${query ? `?${query}` : ""}`,
    undefined,
    "GET"
  );
}

/** The canonical event-type list, straight from the backend's own
 * `client_ops::audit_log::event::ALL` -- backs the "which events" filter
 * dropdown so it can't drift from what the backend actually writes. */
export async function listActivityLogEventTypes(): Promise<
  AuthResult<{ event_types: string[] }>
> {
  return tryAuthFetch("/client-ops/activity-logs/event-types", undefined, "GET");
}

/** Filters shared by the activity-log PDF export and its live preview --
 * same shape, since both hit the identical backend filter query. No IP
 * filter (unlike the security log's export): most activity rows have no
 * meaningful IP (a scheduled sync's actor is the system placeholder). */
export interface ActivityLogExportRequest {
  dateFrom: string;
  dateTo: string;
  eventTypes?: string[];
  entityTypes?: string[];
  actorUserIds?: string[];
}

function toExportRequestBody(request: ActivityLogExportRequest) {
  return {
    date_from: `${request.dateFrom}T00:00:00Z`,
    date_to: `${request.dateTo}T23:59:59Z`,
    event_types: request.eventTypes ?? [],
    entity_types: request.entityTypes ?? [],
    actor_user_ids: request.actorUserIds ?? [],
  };
}

export interface ActivityLogPreviewRow {
  id: string;
  created_at: string;
  event_type: string;
  actor_label: string;
  target_label: string;
  details: string;
}

/** A small, JSON preview of what the PDF export would contain -- backs
 * the export filters page's "what will be in the report" panel, without
 * generating a full PDF on every filter change. */
export async function previewActivityLogsExport(
  request: ActivityLogExportRequest
): Promise<AuthResult<{ rows: ActivityLogPreviewRow[]; truncated: boolean }>> {
  return tryAuthFetch(
    "/client-ops/activity-logs/export/preview",
    toExportRequestBody(request)
  );
}

/** The actual PDF deliverable -- same filters as the preview, no row cap
 * tuned for responsiveness. */
export async function exportActivityLogsPdf(
  request: ActivityLogExportRequest
): Promise<FileDownloadResult> {
  return fetchForDownload(
    "/client-ops/activity-logs/export",
    toExportRequestBody(request)
  );
}
