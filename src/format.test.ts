import { describe, it, expect } from "vitest";
import {
  formatAmount,
  formatDate,
  generateFileName,
  parseAmount,
} from "./format";

describe("formatAmount", () => {
  it("formats 5162 with space separator", () => {
    expect(formatAmount(5162)).toBe("5 162");
  });

  it("formats 999 without separator", () => {
    expect(formatAmount(999)).toBe("999");
  });

  it("formats 10000", () => {
    expect(formatAmount(10000)).toBe("10 000");
  });

  it("formats amount with cents", () => {
    expect(formatAmount(5044.24)).toBe("5 044.24");
  });

  it("formats small amount with cents", () => {
    expect(formatAmount(63.84)).toBe("63.84");
  });

  it("omits cents when amount is whole number", () => {
    expect(formatAmount(3360)).toBe("3 360");
  });

  it("formats amount with trailing zero cent", () => {
    expect(formatAmount(100.10)).toBe("100.10");
  });
});

describe("formatDate", () => {
  it("formats date as DD.MM.YYYY", () => {
    expect(formatDate(new Date(2026, 0, 31))).toBe("31.01.2026");
  });

  it("pads single digits", () => {
    expect(formatDate(new Date(2026, 2, 5))).toBe("05.03.2026");
  });
});

describe("generateFileName", () => {
  it("generates filename with provided surname and customerShort", () => {
    expect(generateFileName(new Date(2026, 0, 31), "Doe", "Client")).toBe(
      "Doe_Invoice_Jan_Client_2026.pdf"
    );
  });

  it("generates filename for December 2025", () => {
    expect(generateFileName(new Date(2025, 11, 31), "Doe", "Client")).toBe(
      "Doe_Invoice_Dec_Client_2025.pdf"
    );
  });

  it("generates filename with different surname and customer", () => {
    expect(generateFileName(new Date(2026, 5, 15), "Smith", "Acme")).toBe(
      "Smith_Invoice_Jun_Acme_2026.pdf"
    );
  });
});

describe("parseAmount", () => {
  it.each([
    ["5263.50", 5263.5],
    ["5263,50", 5263.5],
    ["3000", 3000],
    ["3,000", 3000],
    ["3.000", 3000],
    ["3 000", 3000],
    ["3\u00a0000,50", 3000.5],
    ["3,000.50", 3000.5],
    ["3.000,50", 3000.5],
    ["1,234,567", 1234567],
    ["1.234.567,8", 1234567.8],
    [" 12.5 ", 12.5],
    ["0,5", 0.5],
  ])("parses %j as %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("passes through positive finite numbers", () => {
    expect(parseAmount(5263.5)).toBe(5263.5);
  });

  it.each([
    "", "abc", "12abc", "1,2,3", "3,00,000", "1.234.56", "1,234.567",
    "0,500", "-5", "0", "12.", ",5", "1.2.3,4.5",
  ])("rejects %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it.each([null, undefined, NaN, Infinity, 0, -1, {}])("rejects non-amount %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});
