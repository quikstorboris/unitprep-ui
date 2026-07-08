export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8080";

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