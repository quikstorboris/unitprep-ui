export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8080";

/**
 * Extracts a human-readable message from a non-2xx API response. Most
 * failures return a structured `{ error, message }` body (see
 * ApiErrorBody in the Rust API) but a few endpoints still return a plain
 * string — fall back to the raw text, then to a bare status code, rather
 * than showing a blank error.
 */
export async function errorMessageFrom(
  response: Response
): Promise<string> {
  const text = await response.text();

  try {
    const body = JSON.parse(text) as {
      message?: string;
    };

    if (body.message) {
      return body.message;
    }
  } catch {
    // Not JSON — fall through to the raw text below.
  }

  return text || `HTTP ${response.status}`;
}

/**
 * Fire-and-forget: tells the backend this session is done, freeing it
 * immediately instead of waiting out the lazy-expiry timeout. Never
 * throws — a failed cancel just means the session expires normally later.
 */
export function cancelSession(
  sessionId: string
): void {
  fetch(`${API_URL}/session/cancel`, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
    }),
  }).catch(() => {});
}