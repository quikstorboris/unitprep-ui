import {
  fetchForDownload,
  tryAuthFetch,
  type AuthResult,
  type FileDownloadResult,
} from "@/lib/auth-shared";

export interface AuditLogEntry {
  id: number;
  event_type: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  limit?: number;
  /** Keyset pagination: only entries older than (lower id than) this one --
   * pass the last entry's `id` from the previous page to fetch the next. */
  beforeId?: number;
  eventType?: string;
  userId?: string;
}

export async function listAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuthResult<{ entries: AuditLogEntry[] }>> {
  const params = new URLSearchParams();
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.beforeId !== undefined) {
    params.set("before_id", String(filters.beforeId));
  }
  if (filters.eventType) params.set("event_type", filters.eventType);
  if (filters.userId) params.set("user_id", filters.userId);

  const query = params.toString();
  return tryAuthFetch(
    `/auth/audit-logs${query ? `?${query}` : ""}`,
    undefined,
    "GET"
  );
}

/** The canonical event-type list, straight from the backend's own
 * `audit_log::event::ALL` -- backs the "which events" filter dropdown so
 * it can't drift from what the backend actually writes. */
export async function listAuditLogEventTypes(): Promise<
  AuthResult<{ event_types: string[] }>
> {
  return tryAuthFetch("/auth/audit-logs/event-types", undefined, "GET");
}

/** Filters shared by the audit-log PDF export and its live preview --
 * same shape, since both hit the identical backend filter query. Dates
 * are plain YYYY-MM-DD (straight from a native `<input type="date">`);
 * converted to UTC day bounds in `toExportRequestBody` so callers don't
 * have to think about start/end-of-day. */
export interface AuditLogExportRequest {
  dateFrom: string;
  dateTo: string;
  eventTypes?: string[];
  userIds?: string[];
  ipAddress?: string;
}

function toExportRequestBody(request: AuditLogExportRequest) {
  return {
    date_from: `${request.dateFrom}T00:00:00Z`,
    date_to: `${request.dateTo}T23:59:59Z`,
    event_types: request.eventTypes ?? [],
    user_ids: request.userIds ?? [],
    ip_address: request.ipAddress || undefined,
  };
}

export interface AuditLogPreviewRow {
  id: number;
  created_at: string;
  event_type: string;
  actor_label: string;
  target_label: string;
  ip_address: string | null;
  details: string;
}

/** A small, JSON preview of what the PDF export would contain -- backs
 * the export filters page's "what will be in the report" panel, without
 * generating a full PDF on every filter change. */
export async function previewAuditLogsExport(
  request: AuditLogExportRequest
): Promise<AuthResult<{ rows: AuditLogPreviewRow[]; truncated: boolean }>> {
  return tryAuthFetch(
    "/auth/audit-logs/export/preview",
    toExportRequestBody(request)
  );
}

/** The actual PDF deliverable -- same filters as the preview, but this
 * one is audited (see AUDIT_LOG_EXPORTED) and has no row cap tuned for
 * responsiveness. */
export async function exportAuditLogsPdf(
  request: AuditLogExportRequest
): Promise<FileDownloadResult> {
  return fetchForDownload(
    "/auth/audit-logs/export",
    toExportRequestBody(request)
  );
}
