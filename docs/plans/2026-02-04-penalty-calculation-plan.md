# Penalty Calculation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic late payment penalty calculation (0.1% per day) with multiple penalty rows in generated PDF invoices.

**Architecture:** New `penalty.ts` module handles calculation logic. Template gets dynamic penalty rows. Server accepts penalty inputs alongside existing invoice data. Web form gets dynamic add/remove penalty row UI with server-side preview calculation.

**Tech Stack:** TypeScript, Express, Vitest, Puppeteer (existing stack — no new dependencies)

---

### Task 1: Add subtractBusinessDays to business-days.ts

**Files:**
- Modify: `src/business-days.ts:1-29`
- Modify: `src/business-days.test.ts:1-69`

**Step 1: Write the failing tests**

Add to `src/business-days.test.ts` after the existing `addBusinessDays` describe block:

```typescript
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
```

Update the import at the top of the test file:

```typescript
import { addBusinessDays, subtractBusinessDays } from "./business-days";
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/business-days.test.ts`
Expected: FAIL — `subtractBusinessDays` is not exported

**Step 3: Write minimal implementation**

Add to `src/business-days.ts` after `addBusinessDays`:

```typescript
export function subtractBusinessDays(
  startDate: Date,
  days: number,
  holidays: ReadonlyArray<string> = [],
): Date {
  const holidaySet = new Set(holidays);
  const result = new Date(startDate);
  let subtracted = 0;

  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    const dayOfWeek = result.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(formatDateKey(result));
    if (!isWeekend && !isHoliday) {
      subtracted++;
    }
  }

  return result;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/business-days.test.ts`
Expected: ALL PASS (16 tests — 10 existing + 6 new)

**Step 5: Commit**

```bash
git add src/business-days.ts src/business-days.test.ts
git commit -m "feat: add subtractBusinessDays for SEPA payment date adjustment"
```

---

### Task 2: Create penalty calculation module

**Files:**
- Create: `src/penalty.ts`
- Create: `src/penalty.test.ts`

**Step 1: Write the failing tests**

Create `src/penalty.test.ts`:

```typescript
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
    // Delay = Jan 29 - Feb 2 = negative → 0
    const result = calculatePenalty({
      invoiceNo: "2026-01",
      invoiceDate: "2026-01-05",
      invoiceAmount: 3360,
      paymentReceivedDate: "2026-01-30",
    });

    expect(result.delayDays).toBe(0);
    expect(result.penaltyAmount).toBe(0);
  });

  it("applies SEPA adjustment: Monday receipt → Friday payment", () => {
    // Received Dec 8 (Monday) → SEPA = Dec 5 (Friday)
    const result = calculatePenalty({
      invoiceNo: "2025-11",
      invoiceDate: "2025-11-03",
      invoiceAmount: 1000,
      paymentReceivedDate: "2025-12-08",
    });

    expect(result.actualPaymentDate).toEqual(new Date(2025, 11, 5));
  });

  it("caps penalty at invoice amount", () => {
    // Very late payment — penalty exceeds invoice amount
    const result = calculatePenalty({
      invoiceNo: "2024-01",
      invoiceDate: "2024-01-02",
      invoiceAmount: 100,
      paymentReceivedDate: "2027-12-31",
    });

    expect(result.penaltyAmount).toBeLessThanOrEqual(100);
  });

  it("skips holidays in due date calculation", () => {
    // Dec 5 (Friday) + 20 BD with Jan 1-2 as holidays → Jan 6 (Tuesday)
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

    expect(result.dueDate).toEqual(new Date(2026, 0, 6));
  });

  it("rounds penalty to 2 decimal places", () => {
    // 4703.75 * 0.001 * 7 = 32.92625 → 32.93
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/penalty.test.ts`
Expected: FAIL — module `./penalty` not found

**Step 3: Write minimal implementation**

Create `src/penalty.ts`:

```typescript
import { addBusinessDays, subtractBusinessDays } from "./business-days.js";

export interface PenaltyInput {
  readonly invoiceNo: string;
  readonly invoiceDate: string;
  readonly invoiceAmount: number;
  readonly paymentReceivedDate: string;
}

export interface PenaltyResult {
  readonly invoiceNo: string;
  readonly dueDate: Date;
  readonly actualPaymentDate: Date;
  readonly delayDays: number;
  readonly penaltyAmount: number;
}

const PENALTY_RATE = 0.001;
const PAYMENT_TERM_DAYS = 20;
const MS_PER_DAY = 86_400_000;

export function calculatePenalty(
  input: PenaltyInput,
  holidays: ReadonlyArray<string> = [],
): PenaltyResult {
  const invoiceDate = new Date(input.invoiceDate);
  const dueDate = addBusinessDays(invoiceDate, PAYMENT_TERM_DAYS, holidays);

  const receivedDate = new Date(input.paymentReceivedDate);
  const actualPaymentDate = subtractBusinessDays(receivedDate, 1, holidays);

  const diffMs = actualPaymentDate.getTime() - dueDate.getTime();
  const delayDays = Math.max(0, Math.round(diffMs / MS_PER_DAY));

  const rawPenalty = input.invoiceAmount * PENALTY_RATE * delayDays;
  const cappedPenalty = Math.min(rawPenalty, input.invoiceAmount);
  const penaltyAmount = Math.round(cappedPenalty * 100) / 100;

  return {
    invoiceNo: input.invoiceNo,
    dueDate,
    actualPaymentDate,
    delayDays,
    penaltyAmount,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/penalty.test.ts`
Expected: ALL PASS (7 tests)

**Step 5: Run all tests to check nothing is broken**

Run: `npx vitest run`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/penalty.ts src/penalty.test.ts
git commit -m "feat: add penalty calculation module with 0.1% per day rate"
```

---

### Task 3: Support decimal amounts in formatAmount and number-to-words

**Files:**
- Modify: `src/format.ts:6-8`
- Modify: `src/format.test.ts`
- Modify: `src/number-to-words.ts`
- Modify: `src/number-to-words.test.ts`

#### Part A: formatAmount decimal support

**Step 1: Write the failing tests**

Add to the `formatAmount` describe block in `src/format.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/format.test.ts`
Expected: FAIL — `formatAmount(100.10)` returns "100.1" instead of "100.10"

**Step 3: Update formatAmount implementation**

Replace the `formatAmount` function in `src/format.ts`:

```typescript
export function formatAmount(amount: number): string {
  const [intPart, decPart] = amount.toFixed(2).split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (decPart === "00") {
    return formattedInt;
  }
  return `${formattedInt}.${decPart}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/format.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/format.ts src/format.test.ts
git commit -m "feat: support decimal amounts in formatAmount"
```

#### Part B: number-to-words cents support

**Step 6: Write the failing tests**

Add to `src/number-to-words.test.ts` — new tests in the `amountToWordsEN` block:

```typescript
  it("converts amount with cents to words", () => {
    expect(amountToWordsEN(5044.24)).toBe(
      "five thousand forty-four euros and twenty-four cents"
    );
  });

  it("converts small amount with cents to words", () => {
    expect(amountToWordsEN(63.84)).toBe(
      "sixty-three euros and eighty-four cents"
    );
  });

  it("converts amount with one cent", () => {
    expect(amountToWordsEN(100.01)).toBe("one hundred euros and one cent");
  });

  it("preserves whole number behavior", () => {
    expect(amountToWordsEN(3360)).toBe("three thousand three hundred sixty euros");
  });
```

Add new tests in the `amountToWordsUA` block:

```typescript
  it("converts amount with cents to words", () => {
    expect(amountToWordsUA(5044.24)).toBe(
      "п'ять тисяч сорок чотири євро двадцять чотири центи"
    );
  });

  it("converts small amount with cents to words", () => {
    expect(amountToWordsUA(63.84)).toBe(
      "шістдесят три євро вісімдесят чотири центи"
    );
  });

  it("converts amount with one cent", () => {
    expect(amountToWordsUA(100.01)).toBe("сто євро один цент");
  });

  it("converts amount with 5 cents", () => {
    expect(amountToWordsUA(100.05)).toBe("сто євро п'ять центів");
  });

  it("preserves whole number behavior with cents", () => {
    expect(amountToWordsUA(3360)).toBe("три тисячі триста шістдесят євро");
  });
```

**Step 7: Run tests to verify they fail**

Run: `npx vitest run src/number-to-words.test.ts`
Expected: FAIL — cents not supported

**Step 8: Update amountToWordsEN**

In `src/number-to-words.ts`, replace `amountToWordsEN`:

```typescript
export const amountToWordsEN = (amount: number): string => {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  const euroWords = toWords(euros).replace(/,/g, "");
  const euroCurrency = euros === 1 ? CURRENCY_EN : CURRENCY_EN_PLURAL;

  if (cents === 0) {
    return `${euroWords} ${euroCurrency}`;
  }

  const centWords = toWords(cents).replace(/,/g, "");
  const centCurrency = cents === 1 ? "cent" : "cents";
  return `${euroWords} ${euroCurrency} and ${centWords} ${centCurrency}`;
};
```

**Step 9: Add getCentSuffix helper and update amountToWordsUA**

Add the `getCentSuffix` helper before `amountToWordsUA`:

```typescript
const getCentSuffix = (n: number): string => {
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return "центів";
  if (lastOne === 1) return "цент";
  if (lastOne >= 2 && lastOne <= 4) return "центи";
  return "центів";
};
```

Replace `amountToWordsUA`:

```typescript
export const amountToWordsUA = (amount: number): string => {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  if (euros === 0 && cents === 0) {
    return `нуль ${CURRENCY_UA}`;
  }

  const parts: Array<string> = [];

  const thousands = Math.floor(euros / 1000);
  const remainder = euros % 1000;

  if (thousands > 0) {
    const thousandsWords = convertHundredsUA(thousands, "feminine");
    const suffix = getThousandSuffix(thousands);
    parts.push(`${thousandsWords} ${suffix}`);
  }

  if (remainder > 0) {
    const remainderWords = convertHundredsUA(remainder, "neuter");
    parts.push(remainderWords);
  }

  if (euros === 0) {
    parts.push(`нуль ${CURRENCY_UA}`);
  } else {
    parts.push(CURRENCY_UA);
  }

  if (cents > 0) {
    const centWords = convertHundredsUA(cents, "masculine");
    const centSuffix = getCentSuffix(cents);
    parts.push(`${centWords} ${centSuffix}`);
  }

  return parts.join(" ");
};
```

**Step 10: Run tests to verify they pass**

Run: `npx vitest run src/number-to-words.test.ts`
Expected: ALL PASS (21 tests — 12 existing + 9 new)

**Step 11: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 12: Commit**

```bash
git add src/format.ts src/format.test.ts src/number-to-words.ts src/number-to-words.test.ts
git commit -m "feat: support decimal amounts with cents in formatting and number-to-words"
```

---

### Task 4: Add penalty rows to invoice template

**Files:**
- Modify: `src/template.ts:1-323`
- Modify: `src/template.test.ts:1-204`

**Step 1: Write the failing tests**

Add `PenaltyRow` to the import in `src/template.test.ts`:

```typescript
import { renderInvoiceHTML, InvoiceData, PenaltyRow } from "./template.js";
```

Update `SAMPLE_DATA` to include the new fields:

```typescript
const SAMPLE_DATA: InvoiceData = {
  invoiceNumber: "2025-12",
  invoiceDate: "31.12.2025",
  hours: 178,
  rate: 29,
  serviceAmount: "5 162",
  totalAmount: "5 162",
  totalWordsEN: "five thousand one hundred sixty-two euros",
  totalWordsUA: "п'ять тисяч сто шістдесят два євро",
  paymentDueDate: "28.01.2026",
  penalties: [],
};
```

Add new tests at the end of the `renderInvoiceHTML` describe block:

```typescript
  it("renders penalty rows in items table", () => {
    const penalties: ReadonlyArray<PenaltyRow> = [
      { invoiceNo: "2025-11", delayDays: 19, penaltyAmount: "63.84" },
      { invoiceNo: "2025-12", delayDays: 12, penaltyAmount: "40.32" },
    ];
    const data: InvoiceData = {
      ...SAMPLE_DATA,
      serviceAmount: "5 162",
      totalAmount: "5 266.16",
      totalWordsEN: "five thousand two hundred sixty-six euros and sixteen cents",
      totalWordsUA: "п'ять тисяч двісті шістдесят шість євро шістнадцять центів",
      penalties,
    };
    const html = renderInvoiceHTML(data, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);

    expect(html).toContain("Penalty for invoice 2025-11 / Пеня за інвойс 2025-11");
    expect(html).toContain("19 days of delay");
    expect(html).toContain("63.84");
    expect(html).toContain("Penalty for invoice 2025-12 / Пеня за інвойс 2025-12");
    expect(html).toContain("12 days of delay");
    expect(html).toContain("40.32");
  });

  it("renders sequential row numbers for penalties", () => {
    const penalties: ReadonlyArray<PenaltyRow> = [
      { invoiceNo: "2025-11", delayDays: 19, penaltyAmount: "63.84" },
    ];
    const data: InvoiceData = { ...SAMPLE_DATA, penalties };
    const html = renderInvoiceHTML(data, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);

    // Row 1 = services, Row 2 = first penalty
    const penaltyRowMatch = html.match(/<td>2<\/td>\s*<td>Penalty for invoice/);
    expect(penaltyRowMatch).not.toBeNull();
  });

  it("uses serviceAmount for the service row and totalAmount for the total", () => {
    const data: InvoiceData = {
      ...SAMPLE_DATA,
      serviceAmount: "3 360",
      totalAmount: "3 423.84",
      penalties: [
        { invoiceNo: "2025-11", delayDays: 19, penaltyAmount: "63.84" },
      ],
    };
    const html = renderInvoiceHTML(data, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);

    // Service row should have serviceAmount
    expect(html).toMatch(
      /Information technology services.*?<td>3 360<\/td>/s
    );
    // Total row should have totalAmount
    expect(html).toMatch(/Total\/Усього:.*?3 423\.84/s);
  });

  it("renders no penalty rows when penalties array is empty", () => {
    const html = renderInvoiceHTML(SAMPLE_DATA, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);
    expect(html).not.toContain("Penalty for invoice");
    expect(html).not.toContain("days of delay");
  });

  it("escapes penalty invoiceNo to prevent XSS", () => {
    const penalties: ReadonlyArray<PenaltyRow> = [
      { invoiceNo: "<script>alert(1)</script>", delayDays: 5, penaltyAmount: "10.00" },
    ];
    const data: InvoiceData = { ...SAMPLE_DATA, penalties };
    const html = renderInvoiceHTML(data, SAMPLE_SUPPLIER, SAMPLE_CUSTOMER);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/template.test.ts`
Expected: FAIL — `serviceAmount` and `PenaltyRow` not in interface

**Step 3: Update InvoiceData interface and template rendering**

In `src/template.ts`, update the `InvoiceData` interface:

```typescript
export interface PenaltyRow {
  readonly invoiceNo: string;
  readonly delayDays: number;
  readonly penaltyAmount: string;
}

export interface InvoiceData {
  readonly invoiceNumber: string;
  readonly invoiceDate: string;
  readonly hours: number;
  readonly rate: number;
  readonly serviceAmount: string;
  readonly totalAmount: string;
  readonly totalWordsEN: string;
  readonly totalWordsUA: string;
  readonly paymentDueDate: string;
  readonly penalties: ReadonlyArray<PenaltyRow>;
}
```

In `renderInvoiceHTML`, add `serviceAmount` to the escaped data object:

```typescript
  const d = {
    invoiceNumber: escapeHTML(data.invoiceNumber),
    invoiceDate: escapeHTML(data.invoiceDate),
    hours: data.hours,
    rate: data.rate,
    serviceAmount: escapeHTML(data.serviceAmount),
    totalAmount: escapeHTML(data.totalAmount),
    totalWordsEN: escapeHTML(data.totalWordsEN),
    totalWordsUA: escapeHTML(data.totalWordsUA),
    paymentDueDate: escapeHTML(data.paymentDueDate),
  };
```

Replace the items table `<tbody>` in the template (lines 272-287) with:

```html
  <tbody>
    <tr>
      <td>1</td>
      <td>Information technology services provided under contract / Послуги з інформаційних технологій, що надаються за контрактом</td>
      <td>${d.hours}</td>
      <td>${d.rate}</td>
      <td>${d.serviceAmount}</td>
    </tr>
${data.penalties.map((p, i) => `    <tr>
      <td>${i + 2}</td>
      <td>Penalty for invoice ${escapeHTML(p.invoiceNo)} / Пеня за інвойс ${escapeHTML(p.invoiceNo)}</td>
      <td>${p.delayDays} days of delay</td>
      <td>${escapeHTML(p.penaltyAmount)}</td>
      <td>${escapeHTML(p.penaltyAmount)}</td>
    </tr>`).join("\n")}
    <tr>
      <td></td>
      <td></td>
      <td></td>
      <td class="text-right"><strong>Total/Усього:</strong></td>
      <td>${d.totalAmount}</td>
    </tr>
  </tbody>
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/template.test.ts`
Expected: ALL PASS (26 tests — 21 existing + 5 new)

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/template.ts src/template.test.ts
git commit -m "feat: add penalty rows to invoice template"
```

---

### Task 5: Update server endpoints for penalties

**Files:**
- Modify: `src/server.ts:1-73`

**Step 1: Update the /api/generate endpoint**

Replace the `/api/generate` handler in `src/server.ts`:

```typescript
app.post("/api/generate", async (req, res) => {
  try {
    const { date, hours, rate, penalties: penaltyInputs = [] } = req.body;
    const invoiceDate = new Date(date);
    const serviceAmount = hours * rate;
    const estimatedEndDate = new Date(invoiceDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + 30);
    const holidays = await fetchHolidaysForRange(
      invoiceDate.getFullYear(),
      estimatedEndDate.getFullYear(),
    );
    const paymentDueDate = addBusinessDays(invoiceDate, 20, holidays);

    const penaltyResults = penaltyInputs.map(
      (p: PenaltyInput) => calculatePenalty(p, holidays),
    );
    const validPenalties = penaltyResults.filter(
      (p: PenaltyResult) => p.delayDays > 0,
    );

    const penaltyTotal = validPenalties.reduce(
      (sum: number, p: PenaltyResult) => sum + p.penaltyAmount,
      0,
    );
    const grandTotal = Math.round((serviceAmount + penaltyTotal) * 100) / 100;

    const data = {
      invoiceNumber: generateInvoiceNumber(invoiceDate),
      invoiceDate: formatDate(invoiceDate),
      hours,
      rate,
      serviceAmount: formatAmount(serviceAmount),
      totalAmount: formatAmount(grandTotal),
      totalWordsEN: amountToWordsEN(grandTotal),
      totalWordsUA: amountToWordsUA(grandTotal),
      paymentDueDate: formatDate(paymentDueDate),
      penalties: validPenalties.map((p: PenaltyResult) => ({
        invoiceNo: p.invoiceNo,
        delayDays: p.delayDays,
        penaltyAmount: formatAmount(p.penaltyAmount),
      })),
    };

    const html = renderInvoiceHTML(data, supplierConfig, customerConfig);
    const fileName = generateFileName(
      invoiceDate,
      supplierConfig.surname,
      supplierConfig.customerShort,
    );
    const filePath = await generatePDF(html, fileName);
    const actualFileName = path.basename(filePath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${actualFileName}`);
    res.sendFile(filePath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});
```

Add the import at the top of `src/server.ts`:

```typescript
import { calculatePenalty } from "./penalty.js";
import type { PenaltyInput, PenaltyResult } from "./penalty.js";
```

**Step 2: Add /api/calculate-penalties endpoint**

Add after the `/api/generate` handler, before `app.listen`:

```typescript
app.post("/api/calculate-penalties", async (req, res) => {
  try {
    const { penalties: penaltyInputs = [] } = req.body;
    const years = new Set<number>();
    for (const p of penaltyInputs) {
      const invoiceDate = new Date(p.invoiceDate);
      years.add(invoiceDate.getFullYear());
      years.add(invoiceDate.getFullYear() + 1);
      const receivedDate = new Date(p.paymentReceivedDate);
      years.add(receivedDate.getFullYear());
    }
    const sortedYears = [...years].sort((a, b) => a - b);
    const holidays = sortedYears.length > 0
      ? await fetchHolidaysForRange(sortedYears[0], sortedYears[sortedYears.length - 1])
      : [];

    const results = penaltyInputs.map((p: PenaltyInput) => {
      const result = calculatePenalty(p, holidays);
      return {
        invoiceNo: result.invoiceNo,
        dueDate: formatDate(result.dueDate),
        actualPaymentDate: formatDate(result.actualPaymentDate),
        delayDays: result.delayDays,
        penaltyAmount: result.penaltyAmount,
      };
    });

    res.json({ penalties: results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: add penalty support to generate endpoint and preview API"
```

---

### Task 6: Add penalty form UI

**Files:**
- Modify: `src/public/index.html`

**Step 1: Update the HTML form**

Replace the entire `src/public/index.html` with the updated version that includes:

1. Existing fields (date, hours, rate) unchanged
2. New "Penalties" section with "Add Penalty" button
3. Dynamic penalty rows with: Invoice No, Invoice Date, Invoice Amount, Payment Received, Remove button
4. Preview display (due date, actual payment, delay days, penalty amount) under each row
5. JavaScript for add/remove rows, debounced API calls to `/api/calculate-penalties`, and updated form submission

Key HTML additions (inside the `<form>`, before the submit button):

```html
      <div class="penalties-section">
        <div class="penalties-header">
          <label>Penalties</label>
          <button type="button" id="add-penalty-btn">+ Add Penalty</button>
        </div>
        <div id="penalty-rows"></div>
      </div>
```

Key CSS additions for penalty rows:

```css
    .penalties-section {
      margin-top: 0.5rem;
      margin-bottom: 1rem;
    }

    .penalties-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .penalties-header button {
      width: auto;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
    }

    .penalty-row {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      position: relative;
    }

    .penalty-row .remove-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: auto;
      padding: 0.1rem 0.5rem;
      background: #d9534f;
      font-size: 0.8rem;
      border-radius: 3px;
    }

    .penalty-row .remove-btn:hover {
      background: #c9302c;
    }

    .penalty-row label {
      font-size: 0.8rem;
      margin-bottom: 0.2rem;
    }

    .penalty-row input {
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .penalty-preview {
      font-size: 0.75rem;
      color: #666;
      background: #f9f9f9;
      padding: 0.4rem 0.5rem;
      border-radius: 3px;
      margin-top: 0.25rem;
    }
```

Key JavaScript additions:

```javascript
    let penaltyCounter = 0;
    let debounceTimer = null;

    document.getElementById("add-penalty-btn").addEventListener("click", function () {
      penaltyCounter++;
      const id = penaltyCounter;
      const row = document.createElement("div");
      row.className = "penalty-row";
      row.dataset.id = id;
      row.innerHTML =
        '<button type="button" class="remove-btn" onclick="this.parentElement.remove(); calculatePenalties();">&times;</button>' +
        '<label>Invoice No</label>' +
        '<input type="text" class="p-invoiceNo" placeholder="2025-11" oninput="debouncedCalc()">' +
        '<label>Invoice Date</label>' +
        '<input type="date" class="p-invoiceDate" oninput="debouncedCalc()">' +
        '<label>Invoice Amount (EUR)</label>' +
        '<input type="number" class="p-amount" step="0.01" min="0" oninput="debouncedCalc()">' +
        '<label>Payment Received</label>' +
        '<input type="date" class="p-received" oninput="debouncedCalc()">' +
        '<div class="penalty-preview" id="preview-' + id + '"></div>';
      document.getElementById("penalty-rows").appendChild(row);
    });

    function getPenaltyInputs() {
      var rows = document.querySelectorAll(".penalty-row");
      var penalties = [];
      rows.forEach(function (row) {
        var invoiceNo = row.querySelector(".p-invoiceNo").value;
        var invoiceDate = row.querySelector(".p-invoiceDate").value;
        var invoiceAmount = Number(row.querySelector(".p-amount").value);
        var paymentReceivedDate = row.querySelector(".p-received").value;
        if (invoiceNo && invoiceDate && invoiceAmount && paymentReceivedDate) {
          penalties.push({ invoiceNo, invoiceDate, invoiceAmount, paymentReceivedDate, rowId: row.dataset.id });
        }
      });
      return penalties;
    }

    function debouncedCalc() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(calculatePenalties, 500);
    }

    async function calculatePenalties() {
      var inputs = getPenaltyInputs();
      if (inputs.length === 0) return;

      try {
        var response = await fetch("/api/calculate-penalties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ penalties: inputs }),
        });
        if (!response.ok) return;
        var data = await response.json();
        data.penalties.forEach(function (p, i) {
          var rowId = inputs[i].rowId;
          var preview = document.getElementById("preview-" + rowId);
          if (preview) {
            preview.textContent = "Due: " + p.dueDate +
              " | Payment: " + p.actualPaymentDate +
              " | Delay: " + p.delayDays + " days" +
              " | Penalty: " + p.penaltyAmount.toFixed(2) + " EUR";
          }
        });
      } catch (e) {
        // silent fail for preview
      }
    }
```

Update the form submit handler to include penalty data:

```javascript
      body: JSON.stringify({
        date: dateInput.value,
        hours: Number(hoursInput.value),
        rate: Number(rateInput.value),
        penalties: getPenaltyInputs(),
      }),
```

**Step 2: Manual test**

Run: `npm start`
Open: `http://localhost:3000`

1. Fill in invoice date, hours, rate
2. Click "Add Penalty", fill in penalty fields
3. Verify preview appears with calculated values
4. Click "Generate PDF" and verify the PDF includes penalty rows
5. Verify PDF with no penalties still generates correctly

**Step 3: Commit**

```bash
git add src/public/index.html
git commit -m "feat: add penalty form UI with dynamic rows and live preview"
```

---

### Final: Run all tests and verify

Run: `npx vitest run`
Expected: ALL PASS (total ~80+ tests)

Verify test count:
- `business-days.test.ts`: 16 tests (10 + 6 new)
- `penalty.test.ts`: 7 tests (all new)
- `format.test.ts`: 14 tests (10 + 4 new)
- `number-to-words.test.ts`: 21 tests (12 + 9 new)
- `template.test.ts`: 26 tests (21 + 5 new)

Total: ~84 tests
