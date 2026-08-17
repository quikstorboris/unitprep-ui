import { expect, test } from "@playwright/test";

import { mockBinaryPost, mockJsonGet, mockJsonPost, seedClient } from "./helpers";

const CLIENT_ID = "e2e-client-tagger";
const SESSION_ID = "session-tagger-1";

const tagCatalog = {
  tags: [
    { tag_key: "m.indate", label: "Move-In Date", category: "Move-In", is_active: true },
    { tag_key: "l.ptd", label: "Paid Through Date", category: "Lease", is_active: true },
  ],
};

// Candidate 0 is unambiguous (auto tier). Candidates 1 and 2 both cover
// the exact same span with different tag_key guesses -- the real shape
// find_candidates produces for a genuinely ambiguous blank (two
// patterns matching the same underscore run).
const taggerReport = {
  session_id: SESSION_ID,
  candidates: [
    {
      index: 0,
      region: "body",
      tag_key: "m.indate",
      matched_text: "___________",
      tier: "auto",
      snippet: "Move-In Date: ___________",
    },
    {
      index: 1,
      region: "body",
      tag_key: "m.indate",
      matched_text: "___",
      tier: "needs_review",
      snippet: "Date: ___",
    },
    {
      index: 2,
      region: "body",
      tag_key: "l.ptd",
      matched_text: "___",
      tier: "needs_review",
      snippet: "Date: ___",
    },
  ],
};

test("reviewing candidates by tier and applying confirmed substitutions", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonGet(page, "http://localhost:8080/client-ops/qms-tags", tagCatalog);
  await mockJsonPost(page, "http://localhost:8080/tagger/report", () => ({
    json: taggerReport,
  }));

  await page.goto(`/clients/${CLIENT_ID}/template-tagger/${SESSION_ID}`);

  await expect(page.getByText("Auto-Apply (1)")).toBeVisible();
  await expect(page.getByText("Needs Review (2)")).toBeVisible();

  // Tier 1 (unambiguous) starts checked; tier 2 (competing candidates for
  // the same span) starts unchecked -- per the design's own rule.
  const autoCheckbox = page.getByRole("checkbox", {
    name: "Apply this substitution for m.indate",
  });
  await expect(autoCheckbox.first()).toBeChecked();

  await expect(page.getByRole("button", { name: /Apply 1 Substitution/ })).toBeVisible();

  // Check the second competing candidate (l.ptd) for the ambiguous blank.
  const needsReviewCheckbox = page.getByRole("checkbox", {
    name: "Apply this substitution for l.ptd",
  });
  await needsReviewCheckbox.check();

  await expect(page.getByRole("button", { name: /Apply 2 Substitutions/ })).toBeVisible();

  await mockBinaryPost(page, "http://localhost:8080/tagger/apply", {
    body: Buffer.from("fake docx bytes"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filename: "lease-tagged.docx",
  });

  // Every candidate here is an underscore blank, so Apply opens the
  // preserve-underscores dialog first; this test isn't about that
  // choice, so just pick "replace outright" (the previous default) and
  // move on.
  await page.getByRole("button", { name: /Apply 2 Substitutions/ }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Replace outright/ }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("lease-tagged.docx");
  await expect(page.getByText("Tagged Document Downloaded")).toBeVisible();
});

test("the tag picker lets a reviewer override a candidate's guessed tag", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonGet(page, "http://localhost:8080/client-ops/qms-tags", tagCatalog);
  await mockJsonPost(page, "http://localhost:8080/tagger/report", () => ({
    json: taggerReport,
  }));

  await page.goto(`/clients/${CLIENT_ID}/template-tagger/${SESSION_ID}`);

  // Candidate index 1 (m.indate, needs review) -- open its picker and
  // switch it to the other competing tag, l.ptd. Scoped by data-testid,
  // not button text: two other rows already show "m.indate"/"l.ptd" as
  // their own starting values, so text alone can't disambiguate which
  // row is under test.
  const candidateRow1 = page.getByTestId("candidate-row-1");
  await candidateRow1.getByRole("button", { name: /^m\.indate/ }).click();
  await candidateRow1.getByText("Paid Through Date").click();

  // The override took effect on this row specifically -- it now shows
  // l.ptd as its picker's current value.
  await expect(
    candidateRow1.getByRole("button", { name: /^l\.ptd/ })
  ).toBeVisible();

  // Candidate index 2 (l.ptd, needs review) is a completely separate
  // row and was never touched -- still showing its own original guess.
  await expect(
    page.getByTestId("candidate-row-2").getByRole("button", { name: /^l\.ptd/ })
  ).toBeVisible();
});

test("the preserve-underscores dialog choice is sent through to /tagger/apply", async ({
  page,
}) => {
  await seedClient(page, CLIENT_ID);

  await mockJsonGet(page, "http://localhost:8080/client-ops/qms-tags", tagCatalog);
  await mockJsonPost(page, "http://localhost:8080/tagger/report", () => ({
    json: taggerReport,
  }));

  const captured: { body: { preserve_blanks?: boolean } | null } = { body: null };
  await page.route("http://localhost:8080/tagger/apply", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
      return;
    }
    captured.body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      body: Buffer.from("fake docx bytes"),
      headers: {
        "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="tagged.docx"',
      },
    });
  });

  await page.goto(`/clients/${CLIENT_ID}/template-tagger/${SESSION_ID}`);

  // Every candidate in `taggerReport` is an underscore blank, so Apply
  // opens the preserve-underscores dialog instead of applying directly.
  await page.getByRole("button", { name: /Apply 1 Substitution/ }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Preserve underscores/ }).click();
  await downloadPromise;

  expect(captured.body?.preserve_blanks).toBe(true);
});
