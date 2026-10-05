import { describe, expect, it } from "vitest";

import type { FacilityPerson } from "@/lib/clientsDetail";
import { sortRoster } from "./personRoster";

function person(full_name: string, legal_owner = false, role = "owner"): FacilityPerson {
  return {
    person_id: full_name,
    full_name,
    email: null,
    phone: null,
    role,
    source: "process_street",
    legal_owner,
  };
}

const names = (roster: FacilityPerson[]) => sortRoster(roster).map((p) => p.full_name);

describe("sortRoster", () => {
  it("puts legal owners first, then everyone else", () => {
    expect(names([person("Amy Baker"), person("Pat Sample", true), person("Zed Adams")])).toEqual([
      "Pat Sample",
      "Amy Baker",
      "Zed Adams",
    ]);
  });

  it("orders legal owners by first name, then last name", () => {
    expect(
      names([
        person("Sam Adams", true),
        person("Pat Zimmer", true),
        person("Pat Baker", true),
        person("Amy Young", true),
      ])
    ).toEqual(["Amy Young", "Pat Baker", "Pat Zimmer", "Sam Adams"]);
  });

  it("orders everyone else by access level: owner, then district manager, then manager", () => {
    expect(
      names([
        person("Amy Manager", false, "manager"),
        person("Zed District", false, "district_manager"),
        person("Bob Owner", false, "owner"),
        person("Cy Manager", false, "manager"),
      ])
    ).toEqual(["Bob Owner", "Zed District", "Amy Manager", "Cy Manager"]);
  });

  it("within an access level, sorts by first name, then last name", () => {
    expect(
      names([
        person("Sam Zimmer", false, "manager"),
        person("Pat Adams", false, "manager"),
        person("Alex Adams", false, "manager"),
        person("Pat Baker", false, "manager"),
      ])
    ).toEqual(["Alex Adams", "Pat Adams", "Pat Baker", "Sam Zimmer"]);
  });

  it("access level never overrides legal-owner status: a legal-owner manager still leads", () => {
    expect(
      names([
        person("Ann District", false, "district_manager"),
        person("Zoe Manager", true, "manager"),
        person("Bea Owner", false, "owner"),
      ])
    ).toEqual(["Zoe Manager", "Bea Owner", "Ann District"]);
  });

  it("treats everything before the last word as the first name, so middle names stay with it", () => {
    // "Laura Cathryn Sample" sorts as first "laura cathryn", last "sample".
    expect(names([person("Pat Adams"), person("Laura Cathryn Sample"), person("Laura Adams")])).toEqual([
      "Laura Adams",
      "Laura Cathryn Sample",
      "Pat Adams",
    ]);
  });

  it("ignores a trailing generational suffix when finding the last name", () => {
    expect(names([person("Pat Example Jr."), person("Pat Example"), person("Pat Abbott III")])).toEqual([
      "Pat Abbott III",
      "Pat Example",
      "Pat Example Jr.",
    ]);
  });

  it("ignores case and treats a single-word name as a first name", () => {
    expect(names([person("pat baker"), person("Cher"), person("Amy Adams")])).toEqual([
      "Amy Adams",
      "Cher",
      "pat baker",
    ]);
  });

  it("sorts an unrecognised access level after the known ones", () => {
    expect(names([person("Ann Odd", false, "contractor"), person("Zed Manager", false, "manager")])).toEqual([
      "Zed Manager",
      "Ann Odd",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [person("Zed Adams"), person("Amy Baker")];
    sortRoster(input);
    expect(input.map((p) => p.full_name)).toEqual(["Zed Adams", "Amy Baker"]);
  });
});
