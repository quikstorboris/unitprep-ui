"use client";

import { useState } from "react";
import { useSessionAction } from "@/lib/useSessionAction";
import { FormatConfirmedSummary } from "@/components/discovery/FormatConfirmedSummary";
import { FormatResolutionActiveView } from "@/components/discovery/FormatResolutionActiveView";
import type { DiscoverResponse } from "@/types/api";

interface FormatConfirmationSectionProps {
  sessionId: string;
  discovery: DiscoverResponse;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
  onReturnToSelection: () => void;
  /** Set by the master group file section's own "Return to Unit File
   * Format" button — hides that section again so attention returns to
   * the (already-visible) completed Format summary here. Cleared by
   * this section's own "Continue" button once the user is done looking. */
  forceShowFormatConfirmation: boolean;
  onFormatConfirmationAcknowledged: () => void;
}

/**
 * Confirming or manually mapping the confirmed unit files' vendor
 * format — the second (and last) gate `UnitFileResolutionPanel` covers,
 * once file selection is done. Renders `FormatResolutionActiveView`
 * (`discovery.requires_format_resolution`) or `FormatConfirmedSummary`
 * (the read-only, already-resolved state) — this component owns just
 * the shared mapping/resolve state and the two handlers both views call.
 */
export function FormatConfirmationSection({
  sessionId,
  discovery,
  onDiscoveryUpdated,
  onSessionExpired,
  onReturnToSelection,
  forceShowFormatConfirmation,
  onFormatConfirmationAcknowledged,
}: FormatConfirmationSectionProps) {
  const [
    mapping,
    setMapping,
  ] = useState<Record<string, string>>({});

  const [
    showManualMapping,
    setShowManualMapping,
  ] = useState(false);

  // Shared by all three resolve-format actions (confirm, map, reset) --
  // their button sets are mutually exclusive in the UI below (confirm/
  // map only render while `requires_format_resolution` is true; reset
  // only renders in the read-only confirmed view), so one pending/error
  // pair covers all three with no risk of one action's state leaking
  // into a visible button for a different one.
  const {
    pending: resolving,
    error: resolveError,
    run: runResolveFormat,
  } = useSessionAction(
    sessionId,
    "/unit-file/resolve-format"
  );

  const submitResolution = async (
    body: Record<string, unknown>
  ) => {
    const result =
      await runResolveFormat(body);

    if (
      result.kind === "sessionExpired"
    ) {
      onSessionExpired();
      return;
    }

    if (result.kind === "error") {
      return;
    }

    // The next discovery response describes a different file (or
    // none, if everything's resolved) — any in-progress manual
    // mapping belonged to whichever file was just resolved.
    setShowManualMapping(false);
    setMapping({});

    onDiscoveryUpdated(
      await result.response.json()
    );
  };

  const handleConfirmVendor = () =>
    submitResolution({
      action: "confirm",
    });

  const handleChangeVendor =
    async () => {
      const result =
        await runResolveFormat({
          action: "reset",
        });

      if (
        result.kind ===
        "sessionExpired"
      ) {
        onSessionExpired();
        return;
      }

      if (result.kind === "error") {
        return;
      }

      onDiscoveryUpdated(
        await result.response.json()
      );
    };

  const handleSubmitMapping = () => {
    const submitted =
      discovery.canonical_target_fields.map(
        (target) => ({
          target,
          source:
            mapping[target] || null,
        })
      );

    return submitResolution({
      action: "map",
      mapping: submitted,
    });
  };

  const openManualMapping = () => {
    const prefilled: Record<
      string,
      string
    > = {};

    for (const suggestion of discovery.suggested_mapping) {
      prefilled[suggestion.target] =
        suggestion.source;
    }

    setMapping(prefilled);
    setShowManualMapping(true);
  };

  const closeManualMapping = () => {
    setShowManualMapping(false);
    setMapping({});
  };

  const handleMappingChange = (
    target: string,
    source: string
  ) => {
    setMapping((prev) => ({
      ...prev,
      [target]: source,
    }));
  };

  const missingRequiredFields =
    discovery.required_target_fields.filter(
      (field) => !mapping[field]
    );

  return discovery.requires_format_resolution ? (
    <FormatResolutionActiveView
      discovery={discovery}
      resolving={resolving}
      resolveError={resolveError}
      showManualMapping={
        showManualMapping
      }
      mapping={mapping}
      missingRequiredFields={
        missingRequiredFields
      }
      onReturnToSelection={
        onReturnToSelection
      }
      onConfirmVendor={
        handleConfirmVendor
      }
      onOpenManualMapping={
        openManualMapping
      }
      onCloseManualMapping={
        closeManualMapping
      }
      onMappingChange={
        handleMappingChange
      }
      onSubmitMapping={
        handleSubmitMapping
      }
    />
  ) : (
    <FormatConfirmedSummary
      discovery={discovery}
      forceShowFormatConfirmation={
        forceShowFormatConfirmation
      }
      resolving={resolving}
      resolveError={resolveError}
      onAcknowledged={
        onFormatConfirmationAcknowledged
      }
      onChangeVendor={
        handleChangeVendor
      }
      onReturnToSelection={
        onReturnToSelection
      }
    />
  );
}
