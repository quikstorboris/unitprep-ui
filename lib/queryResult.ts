import type { ApiResult } from "@/lib/http";

/** What a query function throws for a non-`ok` API result: carries the
 * API's own message, which is what the screens show. */
export class ApiQueryError extends Error {
  readonly kind: "unauthorized" | "error";

  constructor(message: string, kind: "unauthorized" | "error") {
    super(message);
    this.name = "ApiQueryError";
    this.kind = kind;
  }
}

/** Adapts an `ApiResult` to what a query function must do: return the data
 * or throw. (A 401 has already told the session-expiry listener inside
 * `lib/http.ts`, which signs the user out; it is also an error here.) */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.kind === "ok") return result.data;
  throw new ApiQueryError(result.message, result.kind);
}

/** The message to show for a query's `error`, or `null` when there is none. */
export function queryErrorMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  return error instanceof Error ? error.message : "Unknown error";
}
