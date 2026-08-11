"use client";

import { useState, type FormEvent } from "react";

import { createQmsTag } from "@/lib/clientOps";
import { inputClass, primaryButtonClass } from "./styles";

/**
 * Just the "new tag" form and its own submit handling -- whether the
 * form is shown at all is a layout concern the parent still owns
 * (the toggle button lives in the page header, not here), but every
 * field, every piece of validation, and the create request itself are
 * self-contained.
 */
export default function CreateTagForm({ onCreated }: { onCreated: () => void }) {
  const [tagKey, setTagKey] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    const result = await createQmsTag(tagKey.trim(), label.trim(), category.trim());
    setCreating(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setTagKey("");
    setLabel("");
    setCategory("");
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded border border-slate-800 bg-slate-900 p-4"
    >
      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Tag key
          <input
            required
            value={tagKey}
            onChange={(event) => setTagKey(event.target.value)}
            placeholder="e.g. e.fname"
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Label
          <input
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. First Name"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Category
          <input
            required
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="e.g. Tenant"
            className={inputClass}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={creating || !tagKey.trim() || !label.trim() || !category.trim()}
        className={`${primaryButtonClass} self-start`}
      >
        {creating ? "Adding…" : "Add tag"}
      </button>
    </form>
  );
}
