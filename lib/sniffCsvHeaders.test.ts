import { describe, expect, it, vi } from "vitest";

import { CSV_SNIFF_BYTES, parseCsvHeaderRecord, readCsvHeaders } from "./sniffCsvHeaders";

describe("parseCsvHeaderRecord", () => {
  it("splits and trims a plain header row, ignoring data rows", () => {
    expect(parseCsvHeaderRecord("First Name, Last Name ,Email\nBob,Jones,b@x.com\n")).toEqual([
      "First Name",
      "Last Name",
      "Email",
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsvHeaderRecord("﻿CustNumb,UnitNumber\n1,2")).toEqual(["CustNumb", "UnitNumber"]);
  });

  it("handles CRLF and bare CR record ends", () => {
    expect(parseCsvHeaderRecord("A,B\r\n1,2\r\n")).toEqual(["A", "B"]);
    expect(parseCsvHeaderRecord("A,B\r1,2")).toEqual(["A", "B"]);
  });

  it("handles quoted fields with commas, escaped quotes and embedded newlines", () => {
    expect(parseCsvHeaderRecord('"Last, First","He said ""hi""","Multi\nLine",Plain\n1,2,3,4')).toEqual([
      "Last, First",
      'He said "hi"',
      "Multi\nLine",
      "Plain",
    ]);
  });

  it("keeps empty middle cells but drops trailing empties", () => {
    expect(parseCsvHeaderRecord("A,,C,,\n")).toEqual(["A", "", "C"]);
  });

  it("splits a tab-delimited first line on tabs", () => {
    expect(parseCsvHeaderRecord("A\tB, C\tD\n1\t2\t3")).toEqual(["A", "B, C", "D"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseCsvHeaderRecord("")).toEqual([]);
  });
});

describe("readCsvHeaders", () => {
  it("reads only the first 64 KB of the file", async () => {
    const big = new File([`A,B\n${"x".repeat(CSV_SNIFF_BYTES * 2)}`], "big.csv");
    const sliceSpy = vi.spyOn(big, "slice");

    expect(await readCsvHeaders(big)).toEqual(["A", "B"]);
    expect(sliceSpy).toHaveBeenCalledWith(0, CSV_SNIFF_BYTES);
  });
});
