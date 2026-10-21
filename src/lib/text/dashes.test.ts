import { describe, expect, it } from "vitest";
import { findDashes } from "./dashes";

describe("findDashes", () => {
  it("returns nothing for clean text", () => {
    expect(findDashes("Book a call. We will confirm by text.")).toEqual([]);
  });

  it("finds an em dash", () => {
    expect(findDashes("Book a call — we confirm by text.")).toEqual([
      { line: 1, column: 13, kind: "em" },
    ]);
  });

  it("finds an en dash", () => {
    expect(findDashes("Hours: 9–5")).toEqual([{ line: 1, column: 9, kind: "en" }]);
  });

  it("ignores plain hyphens", () => {
    expect(findDashes("cash-based, in-network")).toEqual([]);
  });

  it("reports the right line across multiple lines", () => {
    const text = "Line one\nLine two — bad\nLine three\nLine four – also bad";
    expect(findDashes(text)).toEqual([
      { line: 2, column: 10, kind: "em" },
      { line: 4, column: 11, kind: "en" },
    ]);
  });
});
