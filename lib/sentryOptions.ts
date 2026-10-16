/**
 * Shared Sentry configuration for the browser, Node and edge runtimes.
 *
 * Off unless NEXT_PUBLIC_SENTRY_DSN is set (a public ingest key, not a
 * secret), so dev, CI and e2e behave exactly as before without it.
 *
 * PII: this app shows tenant names, emails and phone numbers, so
 * sendDefaultPii stays off, Session Replay is never enabled, and
 * `scrubEvent` strips request bodies, cookies, query strings and the
 * single-use invite token from every URL before anything leaves the
 * browser or server.
 */

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "x-api-key",
]);

/** `/invites/<token>` is a credential (it also drives account recovery). */
export function redactUrl(url: string): string {
  return url.replace(/\/invites\/[^/?#]+/g, "/invites/[token]");
}

interface ScrubbableEvent {
  transaction?: string;
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    headers?: Record<string, string>;
  };
  breadcrumbs?: Array<{ data?: Record<string, unknown> }>;
  user?: unknown;
}

const URL_DATA_KEYS = ["url", "from", "to"];

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.transaction) event.transaction = redactUrl(event.transaction);

  const request = event.request;
  if (request) {
    if (request.url) request.url = redactUrl(request.url);
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    if (request.headers) {
      for (const name of Object.keys(request.headers)) {
        if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
          delete request.headers[name];
        }
      }
    }
  }

  for (const crumb of event.breadcrumbs ?? []) {
    for (const key of URL_DATA_KEYS) {
      const value = crumb.data?.[key];
      if (crumb.data && typeof value === "string") {
        crumb.data[key] = redactUrl(value);
      }
    }
  }

  delete event.user;
  return event;
}

export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const tracesSampleRate = Number(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0"
  );
  return {
    dsn,
    enabled: Boolean(dsn),
    release: `unitprep-ui@${process.env.NEXT_PUBLIC_APP_VERSION}`,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",
    sendDefaultPii: false,
    // Errors only unless a rate between 0 and 1 is configured.
    tracesSampleRate:
      tracesSampleRate >= 0 && tracesSampleRate <= 1 ? tracesSampleRate : 0,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  };
}
