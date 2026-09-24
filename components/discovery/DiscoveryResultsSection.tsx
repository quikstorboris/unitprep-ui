"use client";

import { useState } from "react";

import { MasterGroupFileSection } from "@/components/discovery/MasterGroupFileSection";
import UnitFileResolutionPanel from "@/components/UnitFileResolutionPanel";
import type { DiscoverResponse, UploadSummary } from "@/types/api";

interface DiscoveryResultsSectionProps {
  sessionId: string;
  discovery: DiscoverResponse;
  uploadSummary: UploadSummary | null;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onScan: () => void;
  onSessionExpired: () => void;
}

/**
 * DiscoveryPage's own "Discovery Results" box -- unit-file resolution,
 * the master group file section, the overall status line, and the
 * Continue button. Owns `netNewAcknowledged` /
 * `forceShowUnitFileSelection` / `forceShowFormatConfirmation` itself,
 * since nothing outside this section reads them.
 */
export function DiscoveryResultsSection({
  sessionId,
  discovery,
  uploadSummary,
  onDiscoveryUpdated,
  onScan,
  onSessionExpired,
}: DiscoveryResultsSectionProps) {
  // Gates Continue when no master group file was found — Boris wants an
  // explicit "yes, this is a net-new client" click rather than the
  // backend's own silent pass-through in that case.
  const [netNewAcknowledged, setNetNewAcknowledged] = useState(false);

  // Lifted here (rather than owned by UnitFileResolutionPanel) so both
  // that panel's own "Return to Unit Files Selection" button and this
  // section's master-group-file section's equivalent button can control
  // the same override — reopening Selection hides every later section
  // until it's reconfirmed.
  const [forceShowUnitFileSelection, setForceShowUnitFileSelection] = useState(false);

  // Set by the master-group-file section's own "Return to Unit File
  // Format" button — a *separate* override from the one above, since
  // that section's previous section is the Format step, not all the way
  // back to Selection.
  const [forceShowFormatConfirmation, setForceShowFormatConfirmation] = useState(false);

  const ready = discovery.ready;

  return (
    <div className="mt-8 rounded border border-slate-700 p-6">
      <h2 className="mb-4 text-xl font-semibold">Discovery Results</h2>

      <div className="space-y-3">
        <p>
          Unit Files Found: <strong>{discovery.unit_files_found}</strong>
        </p>

        <p>
          Master Group Files Found: <strong>{discovery.group_files_found}</strong>
        </p>

        <p>
          Odd Group Names Found:{" "}
          <strong className={discovery.uncommon_group_names.length > 0 ? "text-yellow-400" : undefined}>
            {discovery.uncommon_group_names.length}
          </strong>
        </p>

        <UnitFileResolutionPanel
          sessionId={sessionId}
          discovery={discovery}
          onDiscoveryUpdated={onDiscoveryUpdated}
          onSessionExpired={onSessionExpired}
          forceShowSelection={forceShowUnitFileSelection}
          onReturnToSelection={() => setForceShowUnitFileSelection(true)}
          onSelectionConfirmed={() => setForceShowUnitFileSelection(false)}
          forceShowFormatConfirmation={forceShowFormatConfirmation}
          onFormatConfirmationAcknowledged={() => setForceShowFormatConfirmation(false)}
        />

        {/* The master group file section only makes sense to act on
            once the unit file itself is settled — showing it earlier
            doesn't cause any real ordering issue (group-file
            classification is independent of unit-file resolution),
            this is purely to keep the workflow reading
            top-to-bottom. Also hidden while an earlier step is
            reopened for editing (forceShowUnitFileSelection or
            forceShowFormatConfirmation) — nothing after a reopened
            step should stay visible until that step is reconfirmed. */}
        {!discovery.requires_unit_file_selection &&
          !discovery.requires_format_resolution &&
          !forceShowUnitFileSelection &&
          !forceShowFormatConfirmation && (
            <MasterGroupFileSection
              sessionId={sessionId}
              discovery={discovery}
              onDiscoveryUpdated={onDiscoveryUpdated}
              onSessionExpired={onSessionExpired}
              onReturnToFormat={() => setForceShowFormatConfirmation(true)}
              netNewAcknowledged={netNewAcknowledged}
              onNetNewAcknowledged={() => setNetNewAcknowledged(true)}
            />
          )}

        <p>
          Status:{" "}
          {ready ? (
            <span className="text-green-400">✅ Ready</span>
          ) : discovery.requires_unit_file_selection ? (
            <span className="text-yellow-400">Awaiting Unit File Selection</span>
          ) : discovery.requires_format_resolution ? (
            <span className="text-yellow-400">Awaiting Format Confirmation</span>
          ) : discovery.selected_group_file_name && !discovery.group_file_confirmed ? (
            <span className="text-yellow-400">Awaiting Master File Confirmation</span>
          ) : !discovery.selected_group_file_name && discovery.group_files_found > 1 ? (
            <span className="text-yellow-400">
              Awaiting Master File Selection — {discovery.group_files_found} candidates found
            </span>
          ) : !discovery.selected_group_file_name &&
            discovery.group_files_found === 0 &&
            !netNewAcknowledged ? (
            <span className="text-yellow-400">Awaiting Master File Selection</span>
          ) : discovery.unit_files_found === 0 ? (
            <span className="text-yellow-400">No unit files found — check your folder selection</span>
          ) : (
            <span className="text-yellow-400">Not ready</span>
          )}
        </p>
      </div>

      <button
        onClick={onScan}
        disabled={
          !ready ||
          forceShowUnitFileSelection ||
          forceShowFormatConfirmation ||
          (uploadSummary !== null && !uploadSummary.integrity_verified) ||
          (discovery.group_files_found === 0 && !discovery.selected_group_file_name && !netNewAcknowledged)
        }
        className="mt-6 rounded bg-green-600 px-4 py-2 disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
