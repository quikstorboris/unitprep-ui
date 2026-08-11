import { expect, test } from "@playwright/test";

import { mockBinaryPost, mockJsonPost, seedClient } from "./helpers";

const CLIENT_ID = "e2e-client-export";
const SESSION_ID = "session-export-1";

const analyzeResponse = {
  facilities: 3,
  global_groups: 10,
  net_new_groups: 1,
  similar_groups: 0,
  advisory_issues: 0,
  net_new_group_details: ["10x10 Climate Wave 3"],
  similar_group_details: [],
  advisory_issue_details: [],
};

test("reviewing analysis and downloading the export ZIP", async ({ page }) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonPost(page, "http://localhost:8080/analyze", () => ({
    json: analyzeResponse,
  }));

  await mockBinaryPost(page, "http://localhost:8080/export", {
    body: Buffer.from("fake zip bytes"),
    contentType: "application/zip",
    filename: "UnitPrep_Output.zip",
  });

  await page.goto(
    `/clients/${CLIENT_ID}/unit-groups/${SESSION_ID}/export`
  );

  await expect(page.getByText("Net New Groups (1)")).toBeVisible();
  await expect(page.getByText("10x10 Climate Wave 3")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Export ZIP" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("UnitPrep_Output.zip");
  await expect(page.getByText("Export Downloaded Successfully")).toBeVisible();
});

test("an analysis failure shows an error instead of the review screen", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonPost(page, "http://localhost:8080/analyze", () => ({
    status: 500,
    json: { message: "analysis engine unavailable" },
  }));

  await page.goto(
    `/clients/${CLIENT_ID}/unit-groups/${SESSION_ID}/export`
  );

  await expect(page.getByText("analysis engine unavailable")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download Export ZIP" })
  ).not.toBeVisible();
});
