"use client";

import MultiSelectDropdown from "@/components/shared/MultiSelectDropdown";

import type { ClientsDirectoryFilters } from "./useClientsDirectory";

const searchInputClass =
  "w-full max-w-md rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const filterControlWidthClass = "w-56";

/** The directory's search box and its four multi-select filters. */
export default function ClientsFilterBar({ filters }: { filters: ClientsDirectoryFilters }) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <input
        type="text"
        value={filters.rawSearch}
        onChange={(event) => filters.setRawSearch(event.target.value)}
        placeholder="Search by facility name, address, phone, or contact… (3+ characters)"
        className={searchInputClass}
      />

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Implementation Manager
          <MultiSelectDropdown
            options={filters.managerOptions}
            selected={filters.selectedManagerIds}
            onChange={filters.setSelectedManagerIds}
            noun="managers"
            className={filterControlWidthClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Sales Rep
          <MultiSelectDropdown
            options={filters.managerOptions}
            selected={filters.selectedRepIds}
            onChange={filters.setSelectedRepIds}
            noun="reps"
            className={filterControlWidthClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          State
          <MultiSelectDropdown
            options={filters.stateOptions}
            selected={filters.selectedStates}
            onChange={filters.setSelectedStates}
            noun="states"
            className={filterControlWidthClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Previous PMS
          <MultiSelectDropdown
            options={filters.previousPmsOptions}
            selected={filters.selectedPreviousPms}
            onChange={filters.setSelectedPreviousPms}
            noun="PMS values"
            className={filterControlWidthClass}
          />
        </label>
      </div>
    </div>
  );
}
