"use client";

import DetailSection from "@/components/clients/DetailSection";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import type { FacilityDetail } from "@/lib/clientsDetail";
import { formatPhone } from "@/lib/format";

export function GeneralTab({ facility }: { facility: FacilityDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <DetailSection
        title="General"
        fields={[
          { label: "Facility Name", value: facility.name },
          { label: "Street Address", value: facility.street_address },
          { label: "City", value: facility.city },
          { label: "State", value: facility.state },
          { label: "ZIP", value: facility.zip },
          { label: "Phone", value: formatPhone(facility.phone) },
          { label: "Email", value: facility.email },
          { label: "Units Count", value: facility.units_count },
          { label: "Primary Storage Offering", value: facility.primary_storage_offering },
          { label: "Previous PMS", value: facility.previous_pms },
          { label: "Access Control System", value: facility.access_control_system },
          { label: "Original Go Live Date", value: facility.go_live_date },
          { label: "Subdomain", value: facility.subdomain },
          { label: "Subdomain Exists in QMS", value: facility.subdomain_exists_in_qms_raw },
          { label: "System Email", value: facility.system_email },
          { label: "Website", value: facility.website_url },
        ]}
      />

      <section className="rounded border border-slate-800 p-5">
        <h2 className="mb-4 text-lg font-semibold">Dropbox</h2>
        {facility.dropbox_folder_url ? (
          <a
            href={facility.dropbox_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded bg-[#0061FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0050d1]"
          >
            <DropboxLogo className="h-4 w-4" />
            Go to DropBox
          </a>
        ) : (
          <p className="text-sm text-slate-500">No Dropbox folder on file for this facility.</p>
        )}
      </section>
    </div>
  );
}
