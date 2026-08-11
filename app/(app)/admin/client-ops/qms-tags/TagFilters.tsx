"use client";

import { inputClass } from "./styles";

export type StatusFilter = "active" | "inactive" | "all";

interface TagFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
}

/**
 * The three live filter controls above the tag table. Purely
 * presentational -- the parent owns the actual filter values, since it
 * also needs them to decide which rows to render.
 */
export default function TagFilters({
  searchQuery,
  onSearchChange,
  categories,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
}: TagFiltersProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by tag key or label…"
        aria-label="Search by tag key or label"
        className={`${inputClass} min-w-[16rem] flex-1`}
      />
      <select
        value={categoryFilter}
        onChange={(event) => onCategoryChange(event.target.value)}
        aria-label="Filter by category"
        className={inputClass}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
        aria-label="Filter by status"
        className={inputClass}
      >
        <option value="active">Active only</option>
        <option value="inactive">Deactivated only</option>
        <option value="all">All statuses</option>
      </select>
    </div>
  );
}
