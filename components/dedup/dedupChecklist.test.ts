import { describe, expect, it } from "vitest";

import { blockReasonFor, checkedFormatNames, initialChecked, runGate } from "./dedupChecklist";
import { classified, folderResponse } from "./dedupTestData";

describe("initialChecked", () => {
  it("pre-selects exactly suggested.selected", () => {
    expect([...initialChecked(folderResponse())]).toEqual(["Directory.xlsx"]);
  });

  it("ignores suggested names the server did not return as files", () => {
    const response = folderResponse();
    response.suggested.selected.push("ghost.csv");
    expect([...initialChecked(response)]).toEqual(["Directory.xlsx"]);
  });
});

describe("blockReasonFor", () => {
  it("allows only recognized primary files", () => {
    const { files } = folderResponse();
    expect(blockReasonFor(files[0])).toBeNull();
    expect(blockReasonFor(files[2])).toMatch(/supporting/);
    expect(blockReasonFor(files[3])).toMatch(/not a dedup file/);
    expect(blockReasonFor(files[4])).toMatch(/could not be read/);
  });
});

describe("runGate", () => {
  const { files } = folderResponse();

  it("blocks when nothing is checked", () => {
    expect(runGate(files, new Set()).canRun).toBe(false);
  });

  it("allows a set of recognized primary files, including alternatives", () => {
    expect(runGate(files, new Set(["Directory.xlsx", "Directory.csv"])).canRun).toBe(true);
  });

  it("blocks and names every checked file that is not runnable", () => {
    const gate = runGate(files, new Set(["Directory.xlsx", "notes.csv", "Ledgers.csv"]));
    expect(gate.canRun).toBe(false);
    expect(gate.blocked.map((b) => b.file.file_name)).toEqual(["Ledgers.csv", "notes.csv"]);
  });
});

describe("checkedFormatNames", () => {
  it("lists each detected format once", () => {
    const list = [
      classified("a.csv"),
      classified("b.csv"),
      classified("c.csv", { format_name: "QSX End Users" }),
    ];
    expect(checkedFormatNames(list, new Set(["a.csv", "b.csv", "c.csv"]))).toEqual([
      "SiteLink Directory",
      "QSX End Users",
    ]);
  });
});
