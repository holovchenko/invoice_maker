import { describe, it, expect } from "vitest";
import {
  formatAmount,
  formatDate,
  generateInvoiceNumber,
  generateFileName,
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

describe("generateInvoiceNumber", () => {
  it("generates YYYY-MM from date", () => {
    expect(generateInvoiceNumber(new Date(2026, 0, 15))).toBe("2026-01");
  });

  it("generates for December", () => {
    expect(generateInvoiceNumber(new Date(2025, 11, 31))).toBe("2025-12");
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
