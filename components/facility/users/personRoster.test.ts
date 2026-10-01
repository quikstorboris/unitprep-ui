import { describe, expect, it } from "vitest";

import type { FacilityPerson } from "@/lib/clientsDetail";
import { sortRoster } from "./personRoster";

function person(full_name: string, legal_owner = false): FacilityPerson {
  return {
    person_id: full_name,
    full_name,
    email: null,
    phone: null,
    role: "owner",
    source: "process_street",
    legal_owner,
  };
}

const names = (roster: FacilityPerson[]) => sortRoster(roster).map((p) => p.full_name);

describe("sortRoster", () => {
  it("puts legal owners first, then everyone else", () => {
    // Zed Adams sorts before Amy Baker by LAST name; Pat Sample leads anyway as a legal owner.
    expect(names([person("Amy Baker"), person("Pat Sample", true), person("Zed Adams")])).toEqual([
      "Pat Sample",
      "Zed Adams",
      "Amy Baker",
    ]);
  });

  it("sorts by last name, then first name, within each group", () => {
    expect(
      names([
        person("Sam Zimmer"),
        person("Pat Adams"),
        person("Alex Adams"),
        person("Dana Zimmer", true),
        person("Chris Baker", true),
      ])
    ).toEqual(["Chris Baker", "Dana Zimmer", "Alex Adams", "Pat Adams", "Sam Zimmer"]);
  });

  it("treats the last word as the surname, so middle names don't change the order", () => {
    // "Laura Cathryn Sample" sorts under Sample, not under Laura or Cathryn.
    expect(names([person("Laura Cathryn Sample"), person("Pat Adams"), person("Sam Zebra")])).toEqual([
      "Pat Adams",
      "Laura Cathryn Sample",
      "Sam Zebra",
    ]);
  });

  it("ignores a trailing generational suffix when finding the surname", () => {
    expect(names([person("Sam Example Jr."), person("Pat Example"), person("Alex Zebra III")])).toEqual([
      "Pat Example",
      "Sam Example Jr.",
      "Alex Zebra III",
    ]);
  });

  it("ignores case and handles a single-word name", () => {
    expect(names([person("pat baker"), person("Amy Adams"), person("Cher")])).toEqual([
      "Amy Adams",
      "pat baker",
      "Cher",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [person("Zed Adams"), person("Amy Baker")];
    sortRoster(input);
    expect(input.map((p) => p.full_name)).toEqual(["Zed Adams", "Amy Baker"]);
  });
});
