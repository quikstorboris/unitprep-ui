"use client";

import { useEffect, useState } from "react";

/**
 * Debounces a fast-changing value (e.g. every keystroke in a search box)
 * down to one update `delayMs` after the last change. The first reusable
 * version of a pattern that previously only existed as one inline
 * `setTimeout`/`clearTimeout` effect in
 * `components/clients/DropboxFolderPicker.tsx` -- that one stays as-is
 * (it also tracks its own loading/error state around the debounced
 * fetch, not just the value), but a second, unrelated caller needing the
 * same "wait for the user to stop typing" behavior is worth its own
 * small hook rather than a second hand-rolled copy.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
