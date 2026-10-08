"use client";

import { formatDateTime } from "@/lib/format";
import { useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { SecretField } from "@/components/integrations/SecretField";
import {
  removeClickUpToken,
  saveClickUpToken,
  testClickUpConnection,
  type ClickUpConnection,
} from "@/lib/clickup";
import { setClickUpConnection, useClickUpConnection } from "@/lib/clickupConnection";
import { hasPermission } from "@/lib/auth-session";
import { useCurrentUser } from "@/lib/currentUser";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded bg-red-900 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

function formatCheckedAt(iso: string | null): string {
  if (!iso) return "never";
  return formatDateTime(iso);
}

function StatusPanel({ connection }: { connection: ClickUpConnection | null }) {
  if (!connection) {
    return <p className="text-sm text-slate-400">Checking your connection…</p>;
  }

  if (connection.status === "not_connected") {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
        <p className="text-sm text-slate-300">Not connected. Paste your ClickUp token below.</p>
      </div>
    );
  }

  const connected = connection.status === "connected";

  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-slate-200">
          {connected ? "Connected" : "ClickUp rejected your saved token"}
          {connection.clickup_username && ` as ${connection.clickup_username}`}
        </p>
      </div>
      {!connected && (
        <p className="mt-1 text-sm text-red-400">
          It was probably revoked or regenerated in ClickUp. Paste a new token below to reconnect.
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Last checked: {formatCheckedAt(connection.last_validated_at)}
        {connection.workspace_names.length > 0 &&
          ` · Workspaces: ${connection.workspace_names.join(", ")}`}
      </p>
    </div>
  );
}

/**
 * The signed-in user's own ClickUp connection. Each user connects their
 * own ClickUp personal API token so that anything Orchestrator does in
 * ClickUp is recorded under their name, not a shared account's. The
 * token is sent to the server once, validated against ClickUp, stored
 * encrypted, and never shown again -- which is why there is no "reveal
 * saved token" here, unlike the admin Integrations pages.
 */
export default function ClickUpPage() {
  const { user } = useCurrentUser();
  // Only a user granted ClickUp fetches anything; RequirePermission
  // below redirects everyone else.
  const userId = hasPermission(user, "integrations.clickup") ? (user?.user_id ?? null) : null;
  const { connection } = useClickUpConnection(userId);

  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Whether the user chose "Replace token" while a working one is saved.
  // A healthy connection shows no input at all -- the form only appears
  // when there is something to enter (nothing saved, or ClickUp rejected
  // the saved one) or the user asks to swap it.
  const [replacing, setReplacing] = useState(false);

  function apply(next: ClickUpConnection) {
    if (userId) setClickUpConnection(userId, next);
  }

  async function handleSave() {
    setError(null);
    setNotice(null);
    setBusy("save");
    const result = await saveClickUpToken(token.trim());
    setBusy(null);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    apply(result.data);
    setToken("");
    setReplacing(false);
    setNotice("Connected. Your token is saved and encrypted; it will not be shown again.");
  }

  async function handleTest() {
    setError(null);
    setNotice(null);
    setBusy("test");
    const result = await testClickUpConnection();
    setBusy(null);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    apply(result.data);
    setNotice(
      result.data.status === "connected"
        ? "ClickUp accepted your token."
        : "ClickUp rejected your saved token."
    );
  }

  async function handleRemove() {
    setError(null);
    setNotice(null);
    setBusy("remove");
    const result = await removeClickUpToken();
    setBusy(null);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    apply(result.data);
    setNotice("Your ClickUp token was removed.");
  }

  const hasSavedToken = connection !== null && connection.status !== "not_connected";
  // Waits for the first status read so a connected user never sees the
  // input flash up before it is known to be unnecessary.
  const showTokenForm =
    connection !== null && (!hasSavedToken || connection.status === "invalid" || replacing);

  return (
    <RequirePermission permission="integrations.clickup">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">ClickUp</h1>
          <p className="mt-1 text-sm text-slate-400">
            Connect your own ClickUp account so updates made from Orchestrator are recorded under
            your name in ClickUp.
          </p>
        </div>

        <section className="mb-8 max-w-xl rounded border border-slate-800 bg-slate-900 p-4">
          <StatusPanel connection={connection} />

          {hasSavedToken && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleTest}
                className={secondaryButtonClass}
              >
                {busy === "test" ? "Testing…" : "Test connection"}
              </button>
              {connection?.status === "connected" && !replacing && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    setReplacing(true);
                  }}
                  className={secondaryButtonClass}
                >
                  Replace token
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleRemove}
                className={dangerButtonClass}
              >
                {busy === "remove" ? "Removing…" : "Remove token"}
              </button>
            </div>
          )}
        </section>

        {/* Outcome of the last action. Outside the token form so it stays
            visible after a successful save hides that form again. */}
        {error && (
          <p role="alert" className="mb-4 max-w-xl text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 max-w-xl text-sm text-green-400">
            {notice}
          </p>
        )}

        {showTokenForm && (
        <section className="max-w-xl">
          <h2 className="mb-2 text-lg font-semibold text-slate-100">
            {hasSavedToken ? "Replace your token" : "Add your token"}
          </h2>

          <ol className="mb-4 list-decimal pl-5 text-sm text-slate-400">
            <li>In ClickUp, open your avatar menu and choose Settings.</li>
            <li>Open Apps and find API Token.</li>
            <li>Click Generate (or copy the existing token) and paste it below.</li>
          </ol>

          <div className="flex flex-col gap-3">
            <SecretField
              label="ClickUp personal API token"
              value={token}
              onChange={(value) => {
                setToken(value);
                setError(null);
                setNotice(null);
              }}
              hint="It acts as you with your full ClickUp access, so treat it like a password. It is checked with ClickUp, then stored encrypted."
            />

            <div>
              <button
                type="button"
                disabled={busy !== null || token.trim().length === 0}
                onClick={handleSave}
                className={primaryButtonClass}
              >
                {busy === "save" ? "Checking with ClickUp…" : hasSavedToken ? "Replace token" : "Connect"}
              </button>
              {replacing && connection?.status === "connected" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setReplacing(false);
                    setToken("");
                    setError(null);
                  }}
                  className={`${secondaryButtonClass} ml-2`}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>
        )}
      </div>
    </RequirePermission>
  );
}
