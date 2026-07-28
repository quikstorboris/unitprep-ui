import { describe, expect, it } from "vitest";

import { formatUnits } from "./format";

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
