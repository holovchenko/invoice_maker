import { describe, it, expect } from "vitest";
import { addBusinessDays } from "./business-days";

describe("addBusinessDays", () => {
  it("adds 20 business days to a Monday", () => {
    // 2026-01-05 is Monday → +20 business days = 2026-02-02 (Monday)
    const result = addBusinessDays(new Date(2026, 0, 5), 20);
    expect(result).toEqual(new Date(2026, 1, 2));
  });

  it("adds 20 business days to a Friday", () => {
    // 2026-01-02 is Friday → +20 business days = 2026-01-30 (Friday)
    const result = addBusinessDays(new Date(2026, 0, 2), 20);
    expect(result).toEqual(new Date(2026, 0, 30));
  });

  it("skips weekends", () => {
    // 2026-01-09 is Friday → +1 business day = 2026-01-12 (Monday)
    const result = addBusinessDays(new Date(2026, 0, 9), 1);
    expect(result).toEqual(new Date(2026, 0, 12));
  });

  it("handles starting on Saturday", () => {
    // 2026-01-10 is Saturday → +1 business day = 2026-01-12 (Monday)
    const result = addBusinessDays(new Date(2026, 0, 10), 1);
    expect(result).toEqual(new Date(2026, 0, 12));
  });

  it("handles starting on Sunday", () => {
    // 2026-01-11 is Sunday → +1 business day = 2026-01-12 (Monday)
    const result = addBusinessDays(new Date(2026, 0, 11), 1);
    expect(result).toEqual(new Date(2026, 0, 12));
  });

  it("handles zero business days", () => {
    const date = new Date(2026, 0, 5);
    const result = addBusinessDays(date, 0);
    expect(result).toEqual(new Date(2026, 0, 5));
  });
});
