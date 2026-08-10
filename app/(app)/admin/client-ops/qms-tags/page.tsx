"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  createQmsTag,
  deactivateQmsTag,
  listQmsTags,
  reactivateQmsTag,
  updateQmsTag,
  type QmsTag,
} from "@/lib/clientOps";
import RequirePermission from "@/components/auth/RequirePermission";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded bg-red-900 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const smallInputClass =
  "rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:border-blue-500 focus:outline-none";

/**
 * Phase 1 admin UI for `client_ops.qms_tag` -- the hand-maintained
 * catalog of QMS's document-template merge tags (see the vault's "QMS
 * Template Tags" note set for why this exists: QMS's own API exposes no
 * tag list, so this is a stand-in maintained by hand until it does).
 * The backend (`client_ops_qms_tags.rs`) shipped 2026-08-07 with no
 * frontend at all; this closes that gap. Tags are never hard-deleted --
 * deactivate/reactivate only -- since a template already referencing a
 * tag needs it to stay resolvable or at least visible.
 */
export default function AdminQmsTagsPage() {
  const [tags, setTags] = useState<QmsTag[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagKey, setNewTagKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function loadTags() {
    const result = await listQmsTags();
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setTags(result.data.tags);
  }

  useEffect(() => {
    queueMicrotask(loadTags);
  }, []);

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);

    const result = await createQmsTag(
      newTagKey.trim(),
      newLabel.trim(),
      newCategory.trim()
    );
    setCreating(false);

    if (result.kind !== "ok") {
      setCreateError(result.message);
      return;
    }

    setNewTagKey("");
    setNewLabel("");
    setNewCategory("");
    setShowCreateForm(false);
    await loadTags();
  }

  function startEdit(tag: QmsTag) {
    setRowError(null);
    setEditingKey(tag.tag_key);
    setEditLabel(tag.label);
    setEditCategory(tag.category);
  }

  function cancelEdit() {
    setEditingKey(null);
  }

  async function handleSaveEdit(tagKey: string) {
    setRowError(null);
    setPendingKey(tagKey);

    const result = await updateQmsTag(
      tagKey,
      editLabel.trim(),
      editCategory.trim()
    );
    setPendingKey(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    setEditingKey(null);
    await loadTags();
  }

  async function handleDeactivate(tag: QmsTag) {
    setRowError(null);
    setPendingKey(tag.tag_key);

    const result = await deactivateQmsTag(tag.tag_key);
    setPendingKey(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    await loadTags();
  }

  async function handleReactivate(tag: QmsTag) {
    setRowError(null);
    setPendingKey(tag.tag_key);

    const result = await reactivateQmsTag(tag.tag_key);
    setPendingKey(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    await loadTags();
  }

  return (
    <RequirePermission permission="client_ops.manage_tags">
      <div className="flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              QMS Tag Catalog
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Hand-maintained reference list of QMS&apos;s document-template
              merge tags (e.g. <code>e.fname</code>). A stand-in until QMS
              exposes its own tag list via its API -- deactivate a tag
              rather than deleting it if it goes stale.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreateForm((value) => !value);
            }}
            className={primaryButtonClass}
          >
            {showCreateForm ? "Cancel" : "Add a tag"}
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateSubmit}
            className="mb-6 flex flex-col gap-4 rounded border border-slate-800 bg-slate-900 p-4"
          >
            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Tag key
                <input
                  required
                  value={newTagKey}
                  onChange={(event) => setNewTagKey(event.target.value)}
                  placeholder="e.g. e.fname"
                  className={`${inputClass} font-mono`}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Label
                <input
                  required
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder="e.g. First Name"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Category
                <input
                  required
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="e.g. Tenant"
                  className={inputClass}
                />
              </label>
            </div>

            {createError && (
              <p role="alert" className="text-sm text-red-400">
                {createError}
              </p>
            )}

            <button
              type="submit"
              disabled={
                creating ||
                !newTagKey.trim() ||
                !newLabel.trim() ||
                !newCategory.trim()
              }
              className={`${primaryButtonClass} self-start`}
            >
              {creating ? "Adding…" : "Add tag"}
            </button>
          </form>
        )}

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {rowError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {rowError}
          </p>
        )}

        {!tags ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Tag key</th>
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => {
                  const isPending = pendingKey === tag.tag_key;
                  const isEditing = editingKey === tag.tag_key;

                  return (
                    <tr
                      key={tag.tag_key}
                      className="border-t border-slate-800"
                    >
                      <td className="px-4 py-2 font-mono text-slate-300">
                        {tag.tag_key}
                      </td>
                      <td className="px-4 py-2 text-slate-200">
                        {isEditing ? (
                          <input
                            value={editLabel}
                            onChange={(event) =>
                              setEditLabel(event.target.value)
                            }
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
                            onChange={(event) =>
                              setEditCategory(event.target.value)
                            }
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
                              disabled={
                                isPending ||
                                !editLabel.trim() ||
                                !editCategory.trim()
                              }
                              onClick={() => handleSaveEdit(tag.tag_key)}
                              className={smallButtonClass}
                            >
                              {isPending ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={cancelEdit}
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
                              onClick={() => startEdit(tag)}
                              className={smallButtonClass}
                            >
                              Edit
                            </button>
                            {tag.is_active ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleDeactivate(tag)}
                                className={dangerButtonClass}
                              >
                                {isPending ? "Working…" : "Deactivate"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleReactivate(tag)}
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
