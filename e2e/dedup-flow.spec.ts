import { expect, test } from "@playwright/test";

import { mockBinaryPost, mockJsonPost, seedClient } from "./helpers";

const CLIENT_ID = "e2e-client-dedup";
const SESSION_ID = "session-dedup-1";

const dedupReport = {
  total_rows: 42,
  unique_tenants: 40,
  multi_unit_tenants: 3,
  flagged_groups: [
    {
      key: "smith-family",
      display_name: "Smith Family",
      units: ["101", "102"],
      categories: ["Phone"],
      bullets: [
        {
          field: "PhoneNumber",
          label: "Phone Number",
          sentence:
            "Unit 101 lists a different phone number than unit 102.",
          cell_refs: [],
        },
      ],
    },
  ],
  typo_variant_candidates: [],
  related_tenant_candidates: [],
};

test("reviewing flagged groups and downloading a CSV export", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonPost(page, "http://127.0.0.1:8080/dedup/report", () => ({
    json: dedupReport,
  }));

  await mockBinaryPost(page, "http://127.0.0.1:8080/dedup/export", {
    body: Buffer.from("name,units\nSmith Family,101;102"),
    contentType: "text/csv",
    filename: "duplicate_tenant_check.csv",
  });

  await page.goto(`/clients/${CLIENT_ID}/dedup/${SESSION_ID}`);

  await expect(page.getByText("Flagged Groups (1)")).toBeVisible();
  await expect(page.getByText("Smith Family")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Export" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("duplicate_tenant_check.csv");
  await expect(page.getByText("Export Downloaded Successfully")).toBeVisible();
});

test("no flagged groups, typo variants, or related tenants shows the all-clear message", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonPost(page, "http://127.0.0.1:8080/dedup/report", () => ({
    json: {
      total_rows: 10,
      unique_tenants: 10,
      multi_unit_tenants: 0,
      flagged_groups: [],
      typo_variant_candidates: [],
      related_tenant_candidates: [],
    },
  }));

  await page.goto(`/clients/${CLIENT_ID}/dedup/${SESSION_ID}`);

  await expect(
    page.getByText(/No duplicate tenants or name variants found/)
  ).toBeVisible();
});
