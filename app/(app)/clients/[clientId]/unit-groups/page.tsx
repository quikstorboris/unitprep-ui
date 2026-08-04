"use client";

import { useParams, useRouter } from "next/navigation";

import DiscoveryPage from "@/components/DiscoveryPage";
import { useDiscoveryFlow } from "@/components/unit-groups/useDiscoveryFlow";
import { cancelSession } from "@/lib/api";

export default function UnitGroupsHome() {
  const router = useRouter();

  const { clientId } =
    useParams<{ clientId: string }>();

  const {
    selectedFiles,
    sessionId,
    discovery,
    uploadSummary,
    loading,
    apiError,
    handleFileSelection,
    handleDiscover,
    handleDiscoveryUpdated,
  } = useDiscoveryFlow();

  return (
    <main className="p-8">
      <DiscoveryPage
        // A new sessionId means a brand-new upload/discovery cycle — force
        // a full remount so this page's local UI-gate state (e.g. the
        // "master file selected" flag, or the child resolution panel's
        // column mapping) can't survive from a previous session's cycle
        // and be shown against data it was never actually validated for.
        key={sessionId}
        selectedFiles={selectedFiles}
        sessionId={sessionId}
        discovery={discovery}
        uploadSummary={
          uploadSummary
        }
        loading={loading}
        apiError={apiError}
        onFileSelection={
          handleFileSelection
        }
        onDiscover={
          handleDiscover
        }
        onDiscoveryUpdated={
          handleDiscoveryUpdated
        }
        onScan={() =>
          router.push(
            `/clients/${clientId}/unit-groups/${sessionId}`
          )
        }
        onBack={() => {
          if (sessionId) {
            cancelSession(sessionId);
          }

          router.push(
            `/clients/${clientId}/info`
          );
        }}
        onSessionExpired={() =>
          router.replace(
            `/clients/${clientId}/info`
          )
        }
      />
    </main>
  );
}
