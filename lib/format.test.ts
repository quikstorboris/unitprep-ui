import { describe, expect, it } from "vitest";

import { formatDateOnly, formatPhone, formatUnits } from "./format";

describe("formatUnits", () => {
  it('returns "no units" for an empty list', () => {
    expect(formatUnits([])).toBe("no units");
  });

  it("names a single unit without a count word", () => {
    expect(formatUnits(["13"])).toBe("unit 13");
  });

  it("joins two units with just \"and\", no comma", () => {
    expect(formatUnits(["54", "67"])).toBe("units 54 and 67");
  });

  it("joins three or more units with an Oxford comma", () => {
    expect(formatUnits(["54", "67", "77"])).toBe("units 54, 67, and 77");
  });

  it("extends the Oxford comma list for four or more units", () => {
    expect(formatUnits(["1", "2", "3", "4"])).toBe("units 1, 2, 3, and 4");
  });
});

describe("formatPhone", () => {
  it("formats a bare 10-digit string as xxx-xxx-xxxx", () => {
    expect(formatPhone("6306500137")).toBe("630-650-0137");
  });

  it("strips existing punctuation before reformatting", () => {
    expect(formatPhone("(630) 650-0137")).toBe("630-650-0137");
  });

  it("drops a leading country-code 1 for an 11-digit number", () => {
    expect(formatPhone("16306500137")).toBe("630-650-0137");
  });

  it("returns a non-10-digit value unchanged rather than mangling it", () => {
    expect(formatPhone("123")).toBe("123");
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("formatDateOnly", () => {
  it("reformats an ISO datetime's date portion as mm-dd-yyyy", () => {
    expect(formatDateOnly("1966-12-09T13:00:00.000Z")).toBe("12-09-1966");
  });

  it("does not shift the date across a differing time-of-day component", () => {
    // Same calendar date, deliberately different (real, observed) time
    // components -- both must resolve to the same mm-dd-yyyy, proving
    // this reads the literal date prefix rather than converting through
    // a Date object's local/UTC getters.
    expect(formatDateOnly("1962-02-26T16:00:00.000Z")).toBe("02-26-1962");
    expect(formatDateOnly("1962-02-26T00:00:00.000Z")).toBe("02-26-1962");
  });

  it("passes through an already date-only value", () => {
    expect(formatDateOnly("1966-12-09")).toBe("12-09-1966");
  });

  it("returns an unrecognized value unchanged", () => {
    expect(formatDateOnly("not a date")).toBe("not a date");
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatDateOnly(null)).toBe("");
    expect(formatDateOnly(undefined)).toBe("");
  });
});
