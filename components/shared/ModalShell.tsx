"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal dialog frame: dimmed backdrop, centred scrollable panel,
 * Escape and backdrop-click to close, focus moved into the panel.
 * `width` is a Tailwind max-width class. Content decides its own
 * header/footer.
 *
 * Added with the Link ClickUp dialog. `PermissionsDialog` still carries
 * its own copy of this frame (same behaviour); moving it onto this
 * shell is a safe follow-up, deliberately not bundled into that feature.
 */
export default function ModalShell({
  labelledBy,
  onClose,
  width = "max-w-lg",
  children,
}: {
  /** id of the element naming the dialog (its heading). */
  labelledBy: string;
  onClose: () => void;
  width?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`max-h-full w-full ${width} overflow-y-auto rounded border border-slate-700 bg-slate-900 p-6 shadow-xl focus:outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
