import { describe, it, expect } from "vitest";
import { addBusinessDays, subtractBusinessDays } from "./business-days";

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

  it("skips public holidays", () => {
    // 2026-01-01 is Thursday (New Year)
    // Starting 2025-12-31 (Wednesday), +1 business day
    // Should skip Jan 1 (holiday) and land on Jan 2 (Friday)
    const holidays = ["2026-01-01"];
    const result = addBusinessDays(new Date(2025, 11, 31), 1, holidays);
    expect(result).toEqual(new Date(2026, 0, 2));
  });

  it("skips consecutive holidays and weekends", () => {
    // 2026-04-17 is Friday (Good Friday holiday in Romania)
    // Starting 2026-04-16 (Thursday), +1 business day
    // Apr 17 = holiday, Apr 18 = Saturday, Apr 19 = Sunday (also Easter), Apr 20 = Monday (Easter Monday holiday)
    // Should land on Apr 21 (Tuesday)
    const holidays = ["2026-04-17", "2026-04-19", "2026-04-20"];
    const result = addBusinessDays(new Date(2026, 3, 16), 1, holidays);
    expect(result).toEqual(new Date(2026, 3, 21));
  });

  it("works with empty holidays array", () => {
    const result = addBusinessDays(new Date(2026, 0, 5), 20, []);
    expect(result).toEqual(new Date(2026, 1, 2));
  });

  it("works without holidays parameter (backward compatible)", () => {
    const result = addBusinessDays(new Date(2026, 0, 5), 20);
    expect(result).toEqual(new Date(2026, 1, 2));
  });
});

describe("subtractBusinessDays", () => {
  it("subtracts 1 business day from a Tuesday", () => {
    // 2026-01-13 is Tuesday → -1 = 2026-01-12 (Monday)
    const result = subtractBusinessDays(new Date(2026, 0, 13), 1);
    expect(result).toEqual(new Date(2026, 0, 12));
  });

  it("subtracts 1 business day from a Monday (skips weekend)", () => {
    // 2026-01-12 is Monday → -1 = 2026-01-09 (Friday)
    const result = subtractBusinessDays(new Date(2026, 0, 12), 1);
    expect(result).toEqual(new Date(2026, 0, 9));
  });

  it("subtracts 1 business day from a Saturday", () => {
    // 2026-01-10 is Saturday → -1 = 2026-01-09 (Friday)
    const result = subtractBusinessDays(new Date(2026, 0, 10), 1);
    expect(result).toEqual(new Date(2026, 0, 9));
  });

  it("subtracts 1 business day from a Sunday", () => {
    // 2026-01-11 is Sunday → -1 = 2026-01-09 (Friday)
    const result = subtractBusinessDays(new Date(2026, 0, 11), 1);
    expect(result).toEqual(new Date(2026, 0, 9));
  });

  it("skips holidays when subtracting", () => {
    // 2026-01-02 is Friday, Jan 1 is holiday
    // -1 business day from Jan 2 → skip Jan 1 → land on Dec 31 (Wednesday)
    const holidays = ["2026-01-01"];
    const result = subtractBusinessDays(new Date(2026, 0, 2), 1, holidays);
    expect(result).toEqual(new Date(2025, 11, 31));
  });

  it("handles zero business days", () => {
    const result = subtractBusinessDays(new Date(2026, 0, 13), 0);
    expect(result).toEqual(new Date(2026, 0, 13));
  });
});
