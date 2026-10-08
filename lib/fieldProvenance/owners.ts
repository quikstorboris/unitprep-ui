import type { FieldProvenanceEntry } from "./types";

/** Owner(s) / Signer Information (Company page + Elavon tab). See `types.ts` for what this table is. */
export const OWNER_FIELDS: FieldProvenanceEntry[] = [
  {
    ooSection: "Owner(s) / Signer Information",
    ooField: "Name / Title / Ownership % / Email / Phone",
    psWorkflow: "New Merchant Account",
    psStep: "Facility Information (Pre-App)",
    psFieldKey: "Signer_-_* / Owner_1..4_-_*",
    psFieldLabel: "Signer - First/Last Name, Title, % Ownership, Email, Home or Cell Phone",
    status: "mapped",
    notes: "One row per party slot PS actually answered (Signer, Owner 1-4).",
  },
  {
    ooSection: "Owner(s) / Signer Information",
    ooField: "SSN (encrypted, fully masked with Show/Hide)",
    psWorkflow: "New Merchant Account",
    psStep: "Facility Information (Pre-App)",
    psFieldKey: "Signer_-_SSN / Owner_1..4_-_SSN",
    psFieldLabel: "Signer/Owner - SSN",
    status: "mapped",
    notes: "The real decrypted SSN still arrives from the API; PartyCard masks it entirely by default (no digits at all, unlike the prior \"last 4 visible\" style) and reveals the real value on click. Corrected 2026-09-03 per Boris's call -- reveal was always meant to stay, only the masked-state rendering changed.",
  },
  {
    ooSection: "Owner(s) / Signer Information",
    ooField: "Date of Birth",
    psWorkflow: "New Merchant Account",
    psStep: "Facility Information (Pre-App)",
    psFieldKey: "Signer_-_DOB / Owner_1..4_-_DOB",
    psFieldLabel: "Signer/Owner - DOB",
    status: "mapped",
  },
  {
    ooSection: "Owner(s) / Signer Information",
    ooField: "Home Address",
    psWorkflow: "New Merchant Account",
    psStep: "Facility Information (Pre-App)",
    psFieldKey: "Signer_-_HOME_Address / _City / _State_or_Province / _Postal_Code",
    psFieldLabel: "Signer/Owner - Home Address, City, State, Postal Code",
    status: "mapped",
  },
  {
    ooSection: "Owner(s) / Signer Information",
    ooField: "Intermediary Business Owner (name, contact, ownership %)",
    psWorkflow: "New Merchant Account",
    psStep: "Facility Information (Pre-App)",
    psFieldKey: "Intermediary_Business_1..4_-_*",
    psFieldLabel: "Intermediary Business 1-4 - Name, Contact, Phone, Email, Ownership %",
    status: "mapped",
    notes: "No SSN/DOB/home address fields exist for a business owner in PS's own template.",
  },
];
