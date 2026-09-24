/**
 * A minimal fake `XMLHttpRequest` for testing code built on
 * `useFileUploadAction` (lib/useFileUploadAction.ts), which uses XHR
 * instead of `fetch` specifically to get real upload-progress events --
 * something `fetch` has no equivalent for on an outgoing request body.
 * Stub it in with `vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest)`,
 * mirroring how every other hook in this app is tested by stubbing
 * `fetch`.
 *
 * Each `new MockXMLHttpRequest()` is recorded in the static
 * `.instances` array so a test can grab the one a component just
 * created (`MockXMLHttpRequest.latest()`) and drive it directly --
 * `.progress(loaded, total)`, `.respond(status, body, headers)`,
 * `.networkError()` -- instead of needing a real network layer. Call
 * `MockXMLHttpRequest.reset()` in `afterEach` so instances don't leak
 * between tests.
 */
export class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  static latest(): MockXMLHttpRequest {
    const xhr =
      MockXMLHttpRequest.instances[
        MockXMLHttpRequest.instances.length - 1
      ];

    if (!xhr) {
      throw new Error(
        "No MockXMLHttpRequest has been constructed yet"
      );
    }

    return xhr;
  }

  static reset(): void {
    MockXMLHttpRequest.instances = [];
  }

  method = "";
  url = "";
  withCredentials = false;
  status = 0;
  statusText = "";
  response: unknown = "";
  sentBody: unknown = null;
  aborted = false;

  upload: {
    onprogress:
      | ((event: {
          lengthComputable: boolean;
          loaded: number;
          total: number;
        }) => void)
      | null;
  } = { onprogress: null };

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  private responseHeaders: Record<string, string> = {};

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  send(body: unknown): void {
    this.sentBody = body;
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    this.onabort?.();
  }

  getAllResponseHeaders(): string {
    return Object.entries(this.responseHeaders)
      .map(([name, value]) => `${name}: ${value}`)
      .join("\r\n");
  }

  // ---- test-driving helpers below; not part of the real XHR interface ----

  /** Simulates the browser reporting outgoing-body progress. */
  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    });
  }

  /** Simulates a completed HTTP response landing. */
  respond(
    status: number,
    body: string,
    headers: Record<string, string> = {}
  ): void {
    this.status = status;
    this.response = body;
    this.responseHeaders = headers;
    this.onload?.();
  }

  /** Simulates a network-level failure (DNS, connection refused, offline)
   * -- the XHR equivalent of `fetch` rejecting with a `TypeError`. */
  networkError(): void {
    this.onerror?.();
  }
}
