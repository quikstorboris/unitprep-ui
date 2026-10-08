import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard with a transient "copied" flag for the button label.
 *
 * `copy(text)` resolves `true` when the browser accepted the write and
 * `false` when it refused (permissions, an insecure context) -- never
 * throws, so a caller that wants to say so can, and one that does not
 * need not wrap it in try/catch. `copied` turns off again after `resetMs`;
 * the timer is cleared on unmount and on a repeat copy, so a late timeout
 * can no longer set state on an unmounted component.
 */
export function useCopyToClipboard(resetMs = 1500): {
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
} {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }

      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, resetMs);
      return true;
    },
    [resetMs],
  );

  return { copied, copy };
}
