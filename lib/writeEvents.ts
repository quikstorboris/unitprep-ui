type Listener = (path: string) => void;

const listeners = new Set<Listener>();

/**
 * Fired by `apiRequest` after every SUCCESSFUL write (anything but a GET),
 * with the API path that was written. The query cache
 * (`components/QueryProvider.tsx`) is the subscriber: it marks the written
 * company's cached reads stale, so a screen that did not remember to refresh
 * after its own save, or a different screen that shows the same data, never
 * serves the old answer as if it were fresh. Same shape and reason as
 * `lib/sessionExpiry.ts`: no imports, so any fetch wrapper can call it
 * without knowing who listens.
 */
export function notifyWriteSucceeded(path: string): void {
  listeners.forEach((listener) => listener(path));
}

export function onWriteSucceeded(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
