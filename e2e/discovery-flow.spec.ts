import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { expect, test, type Page, type Route } from "@playwright/test";

import { CORS_HEADERS, mockJsonPost, seedClient } from "./helpers";

// The folder picker is a real `<input webkitdirectory>` -- Playwright
// requires setInputFiles on one of these to be given an actual directory
// path (not in-memory file payloads, which work for a plain file input),
// so each test writes a throwaway folder with one CSV in it and points
// the picker there.
function makeUploadFolder(): string {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "unitprep-e2e-")
  );
  fs.writeFileSync(
    path.join(dir, "units.csv"),
    "Name,UnitGroup\nA,Wave 1"
  );
  return dir;
}

/**
 * Covers the discovery path (`/clients/[clientId]/unit-groups` and its
 * session sub-route) end to end: upload -> discover -> confirm unit
 * files -> confirm format -> acknowledge net-new -> reach scan results.
 * No other e2e spec touches this path at all -- `DiscoveryPage`,
 * `UnitFileResolutionPanel`, and everything under `discovery/` had zero
 * integration-level coverage before this, which is exactly why a dead
 * "Cancel" button three components deep (`UnitFileSelectionSection`)
 * went undetected.
 *
 * No real backend is used, matching every other e2e spec here -- /upload,
 * /discover, /unit-file/select, /unit-file/resolve-format, and /validate
 * are all mocked via page.route().
 */

const CLIENT_ID = "e2e-client-discovery";

async function mockUpload(
  page: Page,
  sessionId: string
) {
  await page.route(
    "http://localhost:8080/upload",
    async (route: Route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      await route.fulfill({
        status: 200,
        json: {
          session_id: sessionId,
          files_uploaded: 1,
          files_failed: 0,
          multipart_errors: 0,
        },
        headers: CORS_HEADERS,
      });
    }
  );
}

function baseDiscovery() {
  return {
    unit_files_found: 1,
    group_files_found: 0,
    group_file_names: [] as string[],
    selected_group_file_name: null,
    group_file_format_valid: null,
    group_file_confirmed: false,
    ready: false,
    discovered_group_names: [] as string[],
    uncommon_group_names: [] as string[],
    unit_file_candidates: [
      {
        file_name: "units.csv",
        modified_at: null,
        detected_vendor: "QSX",
      },
    ],
    selected_unit_file_names: [] as string[],
    requires_unit_file_selection: true,
    requires_format_resolution: false,
    current_unit_file_name: null,
    pending_unit_file_names: [] as string[],
    mismatched_header_files: [] as string[],
    detected_vendor_name: null,
    confirmed_vendor_name: null,
    source_headers: [] as string[],
    suggested_mapping: [] as unknown[],
    canonical_target_fields: [] as string[],
    required_target_fields: [] as string[],
  };
}

test("upload through discover, confirm unit files, confirm format, and reach scan results", async ({
  page,
}) => {
  const sessionId = "session-discovery-1";

  await seedClient(page, CLIENT_ID);
  await mockUpload(page, sessionId);

  await mockJsonPost(page, "http://localhost:8080/discover", () => ({
    json: baseDiscovery(),
  }));

  await page.goto(`/clients/${CLIENT_ID}/unit-groups`);

  await page
    .locator("#unitprep-folder-picker")
    .setInputFiles(makeUploadFolder());

  await expect(
    page.getByText("Folder contents loaded and ready for upload.")
  ).toBeVisible();

  await page.getByRole("button", { name: "Discover" }).click();

  await expect(page.getByText("Select Unit Files")).toBeVisible();

  // Now that unit-file selection is showing, re-mock /discover's
  // successor endpoints for the rest of the pipeline.
  await mockJsonPost(page, "http://localhost:8080/unit-file/select", () => ({
    json: {
      ...baseDiscovery(),
      requires_unit_file_selection: false,
      requires_format_resolution: true,
      selected_unit_file_names: ["units.csv"],
      current_unit_file_name: "units.csv",
      detected_vendor_name: "QSX",
      source_headers: ["Name", "UnitGroup"],
      canonical_target_fields: ["Name", "UnitGroup"],
      required_target_fields: ["Name", "UnitGroup"],
    },
  }));

  await page.getByRole("button", { name: "Confirm Selection" }).click();

  await expect(page.getByText("Confirm Unit File Format")).toBeVisible();

  await mockJsonPost(
    page,
    "http://localhost:8080/unit-file/resolve-format",
    () => ({
      json: {
        ...baseDiscovery(),
        requires_unit_file_selection: false,
        requires_format_resolution: false,
        selected_unit_file_names: ["units.csv"],
        confirmed_vendor_name: "QSX",
        ready: true,
      },
    })
  );

  await page.getByRole("button", { name: "Confirm QSX" }).click();

  await expect(page.getByText("✅ Unit Files Selected")).toBeVisible();
  await expect(
    page.getByText("Master Group File", { exact: true })
  ).toBeVisible();

  // No master group file was found for this client -- explicitly
  // acknowledge net-new before Continue unlocks (frontend-only state,
  // no request involved).
  await page.getByRole("button", { name: "Net New Client" }).click();

  await mockJsonPost(page, "http://localhost:8080/validate", () => ({
    json: {
      files_checked: 1,
      issue_count: 0,
      error_count: 0,
      warning_count: 0,
      issues: [],
      files_errored: [],
      ready: true,
    },
  }));

  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/unit-groups/${sessionId}$`)
  );
  await expect(page.getByText("Validation Results")).toBeVisible();
  await expect(
    page.getByText("✅ Validation completed successfully.")
  ).toBeVisible();
});

test("reopening unit file selection and clicking Cancel returns to the confirmed summary", async ({
  page,
}) => {
  const sessionId = "session-discovery-2";

  await seedClient(page, CLIENT_ID);
  await mockUpload(page, sessionId);

  await mockJsonPost(page, "http://localhost:8080/discover", () => ({
    json: baseDiscovery(),
  }));

  await page.goto(`/clients/${CLIENT_ID}/unit-groups`);

  await page
    .locator("#unitprep-folder-picker")
    .setInputFiles(makeUploadFolder());

  await page.getByRole("button", { name: "Discover" }).click();

  await expect(page.getByText("Select Unit Files")).toBeVisible();

  await mockJsonPost(page, "http://localhost:8080/unit-file/select", () => ({
    json: {
      ...baseDiscovery(),
      requires_unit_file_selection: false,
      requires_format_resolution: true,
      selected_unit_file_names: ["units.csv"],
      current_unit_file_name: "units.csv",
      detected_vendor_name: "QSX",
      source_headers: ["Name", "UnitGroup"],
      canonical_target_fields: ["Name", "UnitGroup"],
      required_target_fields: ["Name", "UnitGroup"],
    },
  }));

  await page.getByRole("button", { name: "Confirm Selection" }).click();

  await expect(page.getByText("Confirm Unit File Format")).toBeVisible();

  // Reopen unit file selection from the Format step's own "Return to
  // Unit Files Selection" button.
  await page
    .getByRole("button", { name: "Return to Unit Files Selection" })
    .click();

  await expect(page.getByText("Select Unit Files")).toBeVisible();
  const cancelButton = page.getByRole("button", { name: "Cancel" });
  await expect(cancelButton).toBeVisible();

  // The bug this guards against: Cancel used to call the same callback
  // that reopened the picker, a no-op that left it stuck open.
  await cancelButton.click();

  await expect(page.getByText("✅ Unit Files Selected")).toBeVisible();
  await expect(page.getByText("Confirm Unit File Format")).toBeVisible();
});
