"use client";

interface PreserveUnderscoresDialogProps {
  onChoose: (preserve: boolean) => void;
  onCancel: () => void;
}

/**
 * Gates the Apply action for a document that has at least one
 * underscore blank -- replaces the old always-visible "Preserve
 * underscores" checkbox with a one-time choice made right when it
 * matters, and only for documents where it's actually a real decision
 * (a document with no blanks at all never shows this).
 */
export default function PreserveUnderscoresDialog({
  onChoose,
  onCancel,
}: PreserveUnderscoresDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-6 text-slate-100">
        <h2 className="mb-3 text-lg font-semibold">
          This document has blank underscores
        </h2>
        <p className="mb-6 text-sm text-slate-300">
          Do you want to keep the underscores around each tag, or replace
          them outright?
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onChoose(true)}
            className="rounded bg-blue-600 px-4 py-2 text-left hover:bg-blue-500"
          >
            Preserve underscores
            <span className="block text-xs font-normal text-blue-100">
              Keeps the blank line, tag centered inside it
            </span>
          </button>

          <button
            onClick={() => onChoose(false)}
            className="rounded bg-slate-700 px-4 py-2 text-left hover:bg-slate-600"
          >
            Replace outright
            <span className="block text-xs font-normal text-slate-400">
              Underscores are removed; the tag takes their place
            </span>
          </button>

          <button
            onClick={onCancel}
            className="mt-2 rounded px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
