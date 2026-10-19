import { describe, expect, it } from "vitest";

import { runIdFromUrl } from "./psRunUrl";

describe("runIdFromUrl", () => {
  it("pulls the id out of a run link with a task suffix", () => {
    expect(
      runIdFromUrl(
        "https://app.process.st/runs/Longview-Self-Storage-QMS-Onboarding-misXFuUwTRgBoTtGVj18wA/tasks/kz5OAp8nG3G2hlrz5FZM1A",
      ),
    ).toBe("misXFuUwTRgBoTtGVj18wA");
  });

  it("handles a run link with no task suffix", () => {
    expect(runIdFromUrl("https://app.process.st/runs/AAA-Storage-Woodland-QMS-Onboarding-tGzzvYtJ991V-gMrtaBArQ")).toBe(
      "tGzzvYtJ991V-gMrtaBArQ",
    );
  });

  it("ignores text that is not a run link", () => {
    expect(runIdFromUrl("KH Moss")).toBeNull();
    expect(runIdFromUrl("https://example.com/runs/abc-misXFuUwTRgBoTtGVj18wA")).toBeNull();
  });
});
