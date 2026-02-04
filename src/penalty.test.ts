import { describe, it, expect } from "vitest";
import { calculatePenalty } from "./penalty";

describe("calculatePenalty", () => {
  it("calculates penalty for a late payment", () => {
    // Invoice sent Nov 28 (Friday), due date = +20 BD = Dec 26 (Friday)
    // Received Jan 15 (Thursday), SEPA adjustment = Jan 14 (Wednesday)
    // Delay = Jan 14 - Dec 26 = 19 calendar days
    // Penalty = 3360 * 0.001 * 19 = 63.84
    const result = calculatePenalty({
      invoiceNo: "2025-11",
      invoiceDate: "2025-11-28",
      invoiceAmount: 3360,
      paymentReceivedDate: "2026-01-15",
    });

    expect(result.invoiceNo).toBe("2025-11");
    expect(result.delayDays).toBe(19);
    expect(result.penaltyAmount).toBe(63.84);
  });

  it("returns zero penalty when paid on time", () => {
    // Invoice sent Jan 5 (Monday), due date = +20 BD = Feb 2 (Monday)
    // Received Feb 3 (Tuesday), SEPA adjustment = Feb 2 (Monday)
    // Delay = Feb 2 - Feb 2 = 0
    const result = calculatePenalty({
      invoiceNo: "2026-01",
      invoiceDate: "2026-01-05",
      invoiceAmount: 3360,
      paymentReceivedDate: "2026-02-03",
    });

    expect(result.delayDays).toBe(0);
    expect(result.penaltyAmount).toBe(0);
  });

  it("returns zero penalty when paid early", () => {
    // Invoice sent Jan 5 (Monday), due date = +20 BD = Feb 2 (Monday)
    // Received Jan 30 (Friday), SEPA adjustment = Jan 29 (Thursday)
    // Delay = Jan 29 - Feb 2 = negative -> 0
    const result = calculatePenalty({
      invoiceNo: "2026-01",
      invoiceDate: "2026-01-05",
      invoiceAmount: 3360,
      paymentReceivedDate: "2026-01-30",
    });

    expect(result.delayDays).toBe(0);
    expect(result.penaltyAmount).toBe(0);
  });

  it("applies SEPA adjustment: Monday receipt -> Friday payment", () => {
    // Received Dec 8 (Monday) -> SEPA = Dec 5 (Friday)
    const result = calculatePenalty({
      invoiceNo: "2025-11",
      invoiceDate: "2025-11-03",
      invoiceAmount: 1000,
      paymentReceivedDate: "2025-12-08",
    });

    expect(result.actualPaymentDate).toEqual(new Date("2025-12-05"));
  });

  it("caps penalty at invoice amount", () => {
    // Very late payment - penalty exceeds invoice amount
    const result = calculatePenalty({
      invoiceNo: "2024-01",
      invoiceDate: "2024-01-02",
      invoiceAmount: 100,
      paymentReceivedDate: "2027-12-31",
    });

    expect(result.penaltyAmount).toBeLessThanOrEqual(100);
  });

  it("skips holidays in due date calculation", () => {
    // Dec 5 (Friday) + 20 BD with Jan 1-2 as holidays -> Jan 6 (Tuesday)
    const holidays = ["2026-01-01", "2026-01-02"];
    const result = calculatePenalty(
      {
        invoiceNo: "2025-12",
        invoiceDate: "2025-12-05",
        invoiceAmount: 1000,
        paymentReceivedDate: "2026-01-20",
      },
      holidays,
    );

    expect(result.dueDate).toEqual(new Date("2026-01-06"));
  });

  it("rounds penalty to 2 decimal places", () => {
    // 4703.75 * 0.001 * 7 = 32.92625 -> 32.93
    const result = calculatePenalty({
      invoiceNo: "2025-10",
      invoiceDate: "2025-10-01",
      invoiceAmount: 4703.75,
      paymentReceivedDate: "2025-11-07",
    });

    const decimalPlaces = result.penaltyAmount.toString().split(".")[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
