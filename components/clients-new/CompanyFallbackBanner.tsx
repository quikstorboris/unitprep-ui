import type { PreviewedRun } from "@/lib/clientsImport";

interface CompanyFallbackBannerProps {
  companySourceRun: PreviewedRun;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * The Review & Create page's own "No Company Contact Info Captured"
 * banner -- shown when the run seeding the Company section answered
 * "Yes" to PS's "same as this Facility?" question, so Corporate contact
 * fields never got asked. Rendered by the parent only while
 * `!companyFallbackHandled && ...` (see the page's own gating).
 */
export function CompanyFallbackBanner({ companySourceRun, onAccept, onDismiss }: CompanyFallbackBannerProps) {
  return (
    <section className="rounded border border-amber-800 bg-amber-950/10 p-5">
      <h2 className="mb-2 text-lg font-semibold">No Company Contact Info Captured</h2>
      <p className="mb-4 text-sm text-slate-400">
        <span className="font-medium text-slate-200">{companySourceRun.facility.name}</span> is marked as
        this company&apos;s first-time facility, but its own Corporate contact fields (address, phone,
        email) came back blank -- this usually means the client answered &quot;Yes&quot; to
        &quot;Is your Corporate Name, Address, Phone Number &amp; Email the same as this
        Facility?&quot;, so Process Street never asked those questions separately. Use this
        facility&apos;s own address, phone, and website for the Company section instead? (Any field
        already filled in, like Legal Name or Subdomain, is left as-is.)
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAccept}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Use Facility Info
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
