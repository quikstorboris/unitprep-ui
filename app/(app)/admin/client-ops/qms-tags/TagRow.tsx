"use client";

import { useState } from "react";

import type { QmsTag } from "@/lib/clientOps";
import {
  dangerButtonClass,
  linkButtonClass,
  smallButtonClass,
  smallInputClass,
} from "./styles";

interface TagRowProps {
  tag: QmsTag;
  isEditing: boolean;
  /** The tag_key of whichever row (if any) currently has a request in
   * flight -- not just this row's own pending state, since the Edit
   * button on every *other* row needs to disable while one row is
   * mid-save. */
  pendingKey: string | null;
  onStartEdit: (tagKey: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (tagKey: string, label: string, category: string) => void;
  onDeactivate: (tag: QmsTag) => void;
  onReactivate: (tag: QmsTag) => void;
}

/**
 * One row of the QMS tag table. The edit-mode input buffer (the label/
 * category text being typed) lives here, local and ephemeral -- it's
 * reset from the tag's current values every time this row actually
 * enters edit mode. Whether this row *is* the one being edited lives in
 * the parent, since only one row can be edited at a time and the
 * parent is what renders the whole list.
 */
export default function TagRow({
  tag,
  isEditing,
  pendingKey,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeactivate,
  onReactivate,
}: TagRowProps) {
  const [editLabel, setEditLabel] = useState(tag.label);
  const [editCategory, setEditCategory] = useState(tag.category);
  const [justCopied, setJustCopied] = useState(false);

  const isPending = pendingKey === tag.tag_key;
  const tagPlaceholder = `{{${tag.tag_key}}}`;

  function handleStartEdit() {
    setEditLabel(tag.label);
    setEditCategory(tag.category);
    onStartEdit(tag.tag_key);
  }

  function handleCopy() {
    navigator.clipboard.writeText(tagPlaceholder);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1500);
  }

  return (
    <tr className="border-t border-slate-800">
      <td className="px-4 py-2 font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <span>{tagPlaceholder}</span>
          <button
            type="button"
            onClick={handleCopy}
            title={justCopied ? "Copied!" : "Copy tag placeholder"}
            aria-label={
              justCopied ? "Copied!" : `Copy ${tagPlaceholder} to clipboard`
            }
            className="text-slate-500 transition-colors hover:text-slate-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-4 py-2 text-slate-200">
        {isEditing ? (
          <input
            value={editLabel}
            onChange={(event) => setEditLabel(event.target.value)}
            className={smallInputClass}
          />
        ) : (
          tag.label
        )}
      </td>
      <td className="px-4 py-2 text-slate-400">
        {isEditing ? (
          <input
            value={editCategory}
            onChange={(event) => setEditCategory(event.target.value)}
            className={smallInputClass}
          />
        ) : (
          tag.category
        )}
      </td>
      <td className="px-4 py-2">
        {tag.is_active ? (
          <span className="text-green-400">Active</span>
        ) : (
          <span className="text-slate-500">Deactivated</span>
        )}
      </td>
      <td className="px-4 py-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending || !editLabel.trim() || !editCategory.trim()}
              onClick={() =>
                onSaveEdit(tag.tag_key, editLabel.trim(), editCategory.trim())
              }
              className={smallButtonClass}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onCancelEdit}
              className={linkButtonClass}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pendingKey !== null}
              onClick={handleStartEdit}
              className={smallButtonClass}
            >
              Edit
            </button>
            {tag.is_active ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onDeactivate(tag)}
                className={dangerButtonClass}
              >
                {isPending ? "Working…" : "Deactivate"}
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onReactivate(tag)}
                className={smallButtonClass}
              >
                {isPending ? "Working…" : "Reactivate"}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
