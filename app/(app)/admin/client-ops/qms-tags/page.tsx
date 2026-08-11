"use client";

import { useEffect, useState } from "react";

import {
  deactivateQmsTag,
  listQmsTags,
  reactivateQmsTag,
  updateQmsTag,
  type QmsTag,
} from "@/lib/clientOps";
import RequirePermission from "@/components/auth/RequirePermission";

import CreateTagForm from "./CreateTagForm";
import { primaryButtonClass } from "./styles";
import TagFilters, { type StatusFilter } from "./TagFilters";
import TagRow from "./TagRow";

/**
 * Phase 1 admin UI for `client_ops.qms_tag` -- the hand-maintained
 * catalog of QMS's document-template merge tags (see the vault's "QMS
 * Template Tags" note set for why this exists: QMS's own API exposes no
 * tag list, so this is a stand-in maintained by hand until it does).
 * The backend (`client_ops_qms_tags.rs`) shipped 2026-08-07 with no
 * frontend at all; this closes that gap. Tags are never hard-deleted --
 * deactivate/reactivate only -- since a template already referencing a
 * tag needs it to stay resolvable or at least visible.
 *
 * Split across CreateTagForm/TagFilters/TagRow so this file only owns
 * what genuinely can't live anywhere else: the loaded tag list, which
 * row (if any) is being edited, and the live filter values -- all
 * needed here specifically because rendering the table requires them.
 */
export default function AdminQmsTagsPage() {
  const [tags, setTags] = useState<QmsTag[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Live filters over the already-loaded catalog -- the whole thing
  // fits comfortably in memory (started at 13 rows), so there's no
  // reason to round-trip the API per keystroke the way a paginated
  // table would need to.
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const categories = Array.from(
    new Set((tags ?? []).map((tag) => tag.category))
  ).sort();

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleTags = (tags ?? []).filter((tag) => {
    const matchesQuery =
      !normalizedQuery ||
      tag.tag_key.toLowerCase().includes(normalizedQuery) ||
      tag.label.toLowerCase().includes(normalizedQuery);
    const matchesCategory = !categoryFilter || tag.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active") === tag.is_active;

    return matchesQuery && matchesCategory && matchesStatus;
  });

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

  async function handleSaveEdit(tagKey: string, label: string, category: string) {
    setRowError(null);
    setPendingKey(tagKey);

    const result = await updateQmsTag(tagKey, label, category);
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
            onClick={() => setShowCreateForm((value) => !value)}
            className={primaryButtonClass}
          >
            {showCreateForm ? "Cancel" : "Add a tag"}
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6">
            <CreateTagForm
              onCreated={() => {
                setShowCreateForm(false);
                loadTags();
              }}
            />
          </div>
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
          <>
            <TagFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categories={categories}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
            />

            {visibleTags.length === 0 ? (
              <p className="text-sm text-slate-400">
                No tags match the current search/filters.
              </p>
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
                    {visibleTags.map((tag) => (
                      <TagRow
                        key={tag.tag_key}
                        tag={tag}
                        isEditing={editingKey === tag.tag_key}
                        pendingKey={pendingKey}
                        onStartEdit={setEditingKey}
                        onCancelEdit={() => setEditingKey(null)}
                        onSaveEdit={handleSaveEdit}
                        onDeactivate={handleDeactivate}
                        onReactivate={handleReactivate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </RequirePermission>
  );
}
