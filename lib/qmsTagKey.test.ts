import { describe, expect, it } from "vitest";

import { sanitizeQmsTagKey } from "./qmsTagKey";

describe("sanitizeQmsTagKey", () => {
  it("keeps letters, digits, dot, plus and minus", () => {
    expect(sanitizeQmsTagKey("e.fname")).toBe("e.fname");
    expect(sanitizeQmsTagKey("d.now+15")).toBe("d.now+15");
    expect(sanitizeQmsTagKey("l.ptd-1")).toBe("l.ptd-1");
    expect(sanitizeQmsTagKey("TenantName2")).toBe("TenantName2");
  });

  it("strips braces so the wrapper cannot be doubled", () => {
    expect(sanitizeQmsTagKey("{{example}}")).toBe("example");
    expect(sanitizeQmsTagKey("{{{{example}}}}")).toBe("example");
  });

  it("strips spaces, underscores and other punctuation", () => {
    expect(sanitizeQmsTagKey("a b_c!@#$%^&*()=/\\\\")).toBe("abc");
  });
});
