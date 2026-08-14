"use client";

import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";

import { totpEnrollBegin, totpEnrollConfirm, type TotpEnrollment } from "@/lib/auth-session";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

interface TotpEnrollFormProps {
  /** Called once a code is confirmed and the credential is enrolled. */
  onEnrolled: () => void;
  /** Rendered as a "Cancel" link when provided. Omit for a mandatory flow
   * (onboarding) that has nothing to cancel back to. */
  onCancel?: () => void;
  /** Starts the enrolment ceremony immediately on mount instead of waiting
   * for a "Set up now" click -- for a forced onboarding step, where
   * there's nothing else on the page to do first. */
  autoStart?: boolean;
}

/**
 * The begin -> scan -> confirm sequence, shared between the account page
 * (optional, user-initiated) and the mandatory onboarding step (forced,
 * auto-started) -- both need the exact same ceremony, just reached
 * differently.
 */
export default function TotpEnrollForm({
  onEnrolled,
  onCancel,
  autoStart = false,
}: TotpEnrollFormProps) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  // Keyed by `secret` rather than replaced wholesale -- lets the render
  // below tell "rendered for the current enrolment" apart from "a stale
  // result for a previous one" without the effect needing to reset this
  // state synchronously (that trips this codebase's
  // react-hooks/set-state-in-effect rule; only the async .then/.catch
  // callback below is allowed to call setState).
  const [qr, setQr] = useState<{ secret: string; dataUrl: string } | null>(
    null
  );
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qrDataUrl =
    enrollment && qr?.secret === enrollment.secret ? qr.dataUrl : null;

  async function beginEnroll() {
    setError(null);
    setPending(true);

    const result = await totpEnrollBegin();
    setPending(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setEnrollment(result.data);
    setCode("");
  }

  // autoStart only ever matters on the very first mount -- this
  // component doesn't re-render for a new autoStart value, so an empty
  // dependency array is correct here, not an oversight.
  //
  // Deferred via queueMicrotask rather than calling beginEnroll directly:
  // beginEnroll's own setError/setPending calls run before its first
  // await, which -- called directly from the effect body -- is exactly
  // the synchronous-setState-in-an-effect this codebase's
  // react-hooks/set-state-in-effect rule catches. Queued as a microtask,
  // those calls happen from that callback's own execution, not the
  // effect's, the same way the QR-rendering effect below is only allowed
  // to call setState from inside its .then/.catch.
  useEffect(() => {
    if (!autoStart) return;
    queueMicrotask(() => {
      beginEnroll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Renders the `otpauth://` URI as a scannable image once an enrolment
  // begins -- a real authenticator app (Google Authenticator, 1Password,
  // Authy) scans this, it doesn't take a URI by hand. The base32 secret
  // is still shown alongside for a camera-less device.
  useEffect(() => {
    if (!enrollment) return;

    let cancelled = false;
    const { secret, provisioning_uri: provisioningUri } = enrollment;

    QRCode.toDataURL(provisioningUri)
      .then((dataUrl) => {
        if (!cancelled) setQr({ secret, dataUrl });
      })
      .catch(() => {
        // Leave `qr` as-is; the "Rendering QR code…" placeholder keeps
        // showing since `qrDataUrl` above never matches this secret. The
        // base32 secret is still on screen as a fallback either way.
      });

    return () => {
      cancelled = true;
    };
  }, [enrollment]);

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    setPending(true);
    const result = await totpEnrollConfirm(trimmedCode);
    setPending(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    onEnrolled();
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={beginEnroll}
          className={primaryButtonClass}
        >
          {pending ? "Starting…" : "Set up an authenticator app"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Scan this with an authenticator app, then enter the 6-digit code it
        shows to confirm it&apos;s working.
      </p>

      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data: URL generated client-side, no next/image benefit
        <img
          src={qrDataUrl}
          alt="Authenticator app QR code"
          width={200}
          height={200}
          className="self-center rounded bg-white p-2"
        />
      ) : (
        <p className="text-xs text-slate-500">Rendering QR code…</p>
      )}

      <p className="break-all text-xs text-slate-500">
        Can&apos;t scan? Enter this key by hand:{" "}
        <span className="font-mono text-slate-400">{enrollment.secret}</span>
      </p>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        6-digit code
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={inputClass}
          placeholder="123456"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !code.trim()}
        className={primaryButtonClass}
      >
        {pending ? "Confirming…" : "Confirm"}
      </button>

      {onCancel && (
        <button type="button" onClick={onCancel} className={linkButtonClass}>
          Cancel
        </button>
      )}
    </form>
  );
}
