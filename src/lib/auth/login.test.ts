import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./login";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Tom@ClicksToCloses.com ")).toBe("tom@clickstocloses.com");
  });

  it("rejects empty input", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("rejects a value without an @ and a domain", () => {
    expect(normalizeEmail("tom")).toBeNull();
    expect(normalizeEmail("tom@")).toBeNull();
    expect(normalizeEmail("@example.com")).toBeNull();
  });

  it("rejects spaces inside", () => {
    expect(normalizeEmail("to m@example.com")).toBeNull();
  });
});
