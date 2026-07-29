"use client";

import { DiscoveredGroupNamesSummary } from "@/components/discovery/DiscoveredGroupNamesSummary";
import { FormatConfirmationSection } from "@/components/discovery/FormatConfirmationSection";
import { UnitFileSelectionSection } from "@/components/discovery/UnitFileSelectionSection";
import type { DiscoverResponse } from "@/types/api";

interface UnitFileResolutionPanelProps {
  sessionId: string;
  discovery: DiscoverResponse;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
  // Controlled by the parent so a later section (the master group file
  // section, a sibling of this whole panel) can also trigger returning
  // here — see DiscoveryPage.tsx.
  forceShowSelection: boolean;
  onReturnToSelection: () => void;
  onSelectionConfirmed: () => void;
  // Set by the master group file section's own "Return to Unit File
  // Format" button — hides that section again so attention returns to
  // the (already-visible) completed Format summary below. Cleared by
  // this panel's own "Continue" button once the user is done looking.
  forceShowFormatConfirmation: boolean;
  onFormatConfirmationAcknowledged: () => void;
}

/**
 * Every discovered unit file — QSX included — needs an explicit
 * confirm-or-map step before discovery can be `ready` (see
 * `unitprep-unit-group`'s `format` module). This panel covers the two
 * gates that can require user input in between "files uploaded" and
 * "ready to validate": confirming which subset of discovered candidates
 * to process (`UnitFileSelectionSection`), then confirming or manually
 * mapping the confirmed files' vendor format (`FormatConfirmationSection`)
 * — with `DiscoveredGroupNamesSummary` interleaved between the two once
 * group names are available.
 *
 * Each step, once completed, renders as a read-only summary that stays
 * visible rather than disappearing — the next step appears below it. The
 * only way back into an earlier, completed step is its "Return to ..."
 * button (or, for the Selection step, one on a later section — see
 * `forceShowSelection`/`onReturnToSelection`).
 */
export default function UnitFileResolutionPanel({
  sessionId,
  discovery,
  onDiscoveryUpdated,
  onSessionExpired,
  forceShowSelection,
  onReturnToSelection,
  onSelectionConfirmed,
  forceShowFormatConfirmation,
  onFormatConfirmationAcknowledged,
}: UnitFileResolutionPanelProps) {
  const showSelectionSection =
    discovery
      .requires_unit_file_selection ||
    forceShowSelection;

  return (
    <>
      <UnitFileSelectionSection
        sessionId={sessionId}
        discovery={discovery}
        onDiscoveryUpdated={
          onDiscoveryUpdated
        }
        onSessionExpired={
          onSessionExpired
        }
        showSelectionSection={
          showSelectionSection
        }
        forceShowSelection={
          forceShowSelection
        }
        onSelectionConfirmed={
          onSelectionConfirmed
        }
      />

      {/* Right after Unit Files Selected, ahead of Confirm Unit File
          Format -- group names still aren't populated until format
          resolution finishes (they read the resolved UnitGroup column,
          not raw headers), so this renders nothing until that happens,
          then appears in this position once it does, one render before
          the Format summary below it. */}
      {!showSelectionSection &&
        discovery.discovered_group_names
          .length > 0 && (
          <DiscoveredGroupNamesSummary
            discovery={discovery}
          />
        )}

      {!showSelectionSection && (
        <FormatConfirmationSection
          sessionId={sessionId}
          discovery={discovery}
          onDiscoveryUpdated={
            onDiscoveryUpdated
          }
          onSessionExpired={
            onSessionExpired
          }
          onReturnToSelection={
            onReturnToSelection
          }
          forceShowFormatConfirmation={
            forceShowFormatConfirmation
          }
          onFormatConfirmationAcknowledged={
            onFormatConfirmationAcknowledged
          }
        />
      )}
    </>
  );
}
