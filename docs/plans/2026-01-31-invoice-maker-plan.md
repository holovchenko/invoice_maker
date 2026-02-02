# Invoice Maker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based invoice generator that takes date, hours, and rate as input and produces a PDF invoice matching the existing example format.

**Architecture:** Express server serves a simple HTML form. On submit, the server computes all derived values (total, words, due date), injects them into an HTML template that replicates the example invoice layout, and uses Puppeteer to render it as a PDF saved to `output/`.

**Tech Stack:** TypeScript, Node.js, Express, Puppeteer, Vitest, number-to-words

---

### Task 1: Project Init

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Initialize npm project**

Run:
```bash
cd /path/to/invoice_maker
npm init -y
```

**Step 2: Install dependencies**

Run:
```bash
npm install express puppeteer number-to-words
npm install -D typescript @types/express @types/number-to-words vitest tsx
```

**Step 3: Configure tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Add scripts to package.json**

Add to `package.json`:
```json
{
  "scripts": {
    "start": "tsx src/server.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 5: Create directories**

Run:
```bash
mkdir -p src/public output
```

**Step 6: Add output/ to .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
output/*.pdf
```

**Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "chore: init project with TypeScript, Express, Puppeteer, Vitest"
```

---

### Task 2: Business Days Calculator

**Files:**
- Create: `src/business-days.ts`
- Create: `src/business-days.test.ts`

**Step 1: Write the failing tests**

Create `src/business-days.test.ts`:
```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/business-days.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/business-days.ts`:
```typescript
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }

  return result;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/business-days.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/business-days.ts src/business-days.test.ts
git commit -m "feat: add business days calculator with tests"
```

---

### Task 3: Number to Words (EN + UA)

**Files:**
- Create: `src/number-to-words.ts`
- Create: `src/number-to-words.test.ts`

**Step 1: Write the failing tests**

Create `src/number-to-words.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { amountToWordsEN, amountToWordsUA } from "./number-to-words";

describe("amountToWordsEN", () => {
  it("converts 5162 to words", () => {
    expect(amountToWordsEN(5162)).toBe(
      "five thousand one hundred sixty-two euros"
    );
  });

  it("converts 1000 to words", () => {
    expect(amountToWordsEN(1000)).toBe("one thousand euros");
  });

  it("converts 1 to words", () => {
    expect(amountToWordsEN(1)).toBe("one euro");
  });

  it("converts 4872 to words", () => {
    expect(amountToWordsEN(4872)).toBe(
      "four thousand eight hundred seventy-two euros"
    );
  });
});

describe("amountToWordsUA", () => {
  it("converts 5162 to words", () => {
    expect(amountToWordsUA(5162)).toBe(
      "п'ять тисяч сто шістдесят два євро"
    );
  });

  it("converts 1000 to words", () => {
    expect(amountToWordsUA(1000)).toBe("одна тисяча євро");
  });

  it("converts 1 to words", () => {
    expect(amountToWordsUA(1)).toBe("одне євро");
  });

  it("converts 4872 to words", () => {
    expect(amountToWordsUA(4872)).toBe(
      "чотири тисячі вісімсот сімдесят два євро"
    );
  });

  it("converts 2 to words", () => {
    expect(amountToWordsUA(2)).toBe("два євро");
  });

  it("converts 21 to words", () => {
    expect(amountToWordsUA(21)).toBe("двадцять одне євро");
  });

  it("converts 100 to words", () => {
    expect(amountToWordsUA(100)).toBe("сто євро");
  });

  it("converts 10000 to words", () => {
    expect(amountToWordsUA(10000)).toBe("десять тисяч євро");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/number-to-words.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/number-to-words.ts`:
```typescript
import numberToWords from "number-to-words";

export function amountToWordsEN(amount: number): string {
  const words = numberToWords.toWords(amount);
  const currency = amount === 1 ? "euro" : "euros";
  return `${words} ${currency}`;
}

const UA_ONES = [
  "", "одне", "два", "три", "чотири", "п'ять",
  "шість", "сім", "вісім", "дев'ять",
];

const UA_TEENS = [
  "десять", "одинадцять", "дванадцять", "тринадцять",
  "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять",
  "вісімнадцять", "дев'ятнадцять",
];

const UA_TENS = [
  "", "", "двадцять", "тридцять", "сорок", "п'ятдесят",
  "шістдесят", "сімдесят", "вісімдесят", "дев'яносто",
];

const UA_HUNDREDS = [
  "", "сто", "двісті", "триста", "чотириста", "п'ятсот",
  "шістсот", "сімсот", "вісімсот", "дев'ятсот",
];

function thousandForm(n: number): string {
  if (n === 1) return "тисяча";
  if (n >= 2 && n <= 4) return "тисячі";
  return "тисяч";
}

function convertHundreds(n: number): string {
  const parts: string[] = [];

  const h = Math.floor(n / 100);
  if (h > 0) parts.push(UA_HUNDREDS[h]);

  const remainder = n % 100;
  if (remainder >= 10 && remainder < 20) {
    parts.push(UA_TEENS[remainder - 10]);
  } else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens > 0) parts.push(UA_TENS[tens]);
    if (ones > 0) parts.push(UA_ONES[ones]);
  }

  return parts.join(" ");
}

function convertThousandsUA(n: number): string {
  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const remainder = n % 1000;

  if (thousands > 0) {
    const thousandOnes = [
      "", "одна", "дві", "три", "чотири", "п'ять",
      "шість", "сім", "вісім", "дев'ять",
    ];

    const tPart = thousands % 100;
    if (tPart >= 10 && tPart < 20) {
      parts.push(UA_TEENS[tPart - 10]);
    } else {
      const tH = Math.floor(thousands / 100);
      if (tH > 0) parts.push(UA_HUNDREDS[tH]);
      const tTens = Math.floor((thousands % 100) / 10);
      const tOnes = thousands % 10;
      if (tTens > 1) parts.push(UA_TENS[tTens]);
      if (tOnes > 0) parts.push(thousandOnes[tOnes]);
    }
    parts.push(thousandForm(thousands % 10 === 0 ? 5 : thousands % 100 >= 10 && thousands % 100 < 20 ? 5 : thousands % 10));
  }

  if (remainder > 0) {
    parts.push(convertHundreds(remainder));
  }

  return parts.join(" ");
}

export function amountToWordsUA(amount: number): string {
  if (amount === 0) return "нуль євро";
  const words = convertThousandsUA(amount);
  return `${words} євро`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/number-to-words.test.ts`
Expected: ALL PASS (may need adjustments to UA logic — iterate until green)

**Step 5: Commit**

```bash
git add src/number-to-words.ts src/number-to-words.test.ts
git commit -m "feat: add number-to-words conversion for EN and UA"
```

---

### Task 4: Invoice Formatting Utilities

**Files:**
- Create: `src/format.ts`
- Create: `src/format.test.ts`

**Step 1: Write the failing tests**

Create `src/format.test.ts`:
```typescript
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
  it("generates filename for January 2026", () => {
    expect(generateFileName(new Date(2026, 0, 31))).toBe(
      "Doe_Invoice_Jan_Client_2026.pdf"
    );
  });

  it("generates filename for December 2025", () => {
    expect(generateFileName(new Date(2025, 11, 31))).toBe(
      "Doe_Invoice_Dec_Client_2025.pdf"
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/format.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/format.ts`:
```typescript
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatAmount(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function generateInvoiceNumber(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function generateFileName(date: Date): string {
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `Doe_Invoice_${month}_Client_${year}.pdf`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/format.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/format.ts src/format.test.ts
git commit -m "feat: add invoice formatting utilities with tests"
```

---

### Task 5: HTML Invoice Template

**Files:**
- Create: `src/template.ts`

**Step 1: Create the HTML template**

Create `src/template.ts` with a function `renderInvoiceHTML(data)` that returns a complete HTML string matching the example PDF layout exactly. The template must include:

- Page title: `Invoice (offer) / Інвойс (оферта) № {{invoiceNumber}}`
- Two-column table with EN/UA supplier and customer info (all hardcoded)
- Subject matter, currency, price, terms rows
- Bank information for both parties (hardcoded)
- Items table: 1 row with description, quantity (hours), price (rate), amount (total)
- Total row and total-to-pay row with words (EN + UA)
- Legal text paragraphs (all hardcoded)
- Supplier signature line
- CSS styled for A4 page, matching the example layout

The function signature:
```typescript
interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  hours: number;
  rate: number;
  totalAmount: string;
  totalWordsEN: string;
  totalWordsUA: string;
  paymentDueDate: string;
}

export function renderInvoiceHTML(data: InvoiceData): string {
  return `<!DOCTYPE html>...`;
}
```

Reference the example PDF at `examples/Doe_Invoice_Dec_Client_2025.pdf` for exact layout, text, and structure.

**Step 2: Commit**

```bash
git add src/template.ts
git commit -m "feat: add HTML invoice template matching example layout"
```

---

### Task 6: PDF Generator

**Files:**
- Create: `src/pdf-generator.ts`

**Step 1: Write the PDF generator**

Create `src/pdf-generator.ts`:
```typescript
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

export async function generatePDF(
  html: string,
  fileName: string
): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePath = path.join(OUTPUT_DIR, fileName);
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
  } finally {
    await browser.close();
  }

  return filePath;
}
```

**Step 2: Commit**

```bash
git add src/pdf-generator.ts
git commit -m "feat: add Puppeteer PDF generator"
```

---

### Task 7: Express Server + Web Form

**Files:**
- Create: `src/server.ts`
- Create: `src/public/index.html`

**Step 1: Create the HTML form**

Create `src/public/index.html` — minimal form with 3 fields (Invoice date, Hours, Hourly rate), a "Generate PDF" button, and basic CSS. On submit, POST to `/api/generate` as JSON. On success, download the returned PDF file.

**Step 2: Create the Express server**

Create `src/server.ts`:
```typescript
import express from "express";
import path from "path";
import fs from "fs";
import { addBusinessDays } from "./business-days";
import { amountToWordsEN, amountToWordsUA } from "./number-to-words";
import {
  formatAmount,
  formatDate,
  generateInvoiceNumber,
  generateFileName,
} from "./format";
import { renderInvoiceHTML } from "./template";
import { generatePDF } from "./pdf-generator";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, "public")));

app.post("/api/generate", async (req, res) => {
  try {
    const { date, hours, rate } = req.body;
    const invoiceDate = new Date(date);
    const totalAmount = hours * rate;
    const paymentDueDate = addBusinessDays(invoiceDate, 20);

    const data = {
      invoiceNumber: generateInvoiceNumber(invoiceDate),
      invoiceDate: formatDate(invoiceDate),
      hours,
      rate,
      totalAmount: formatAmount(totalAmount),
      totalWordsEN: amountToWordsEN(totalAmount),
      totalWordsUA: amountToWordsUA(totalAmount),
      paymentDueDate: formatDate(paymentDueDate),
    };

    const html = renderInvoiceHTML(data);
    const fileName = generateFileName(invoiceDate);
    const filePath = await generatePDF(html, fileName);

    res.download(filePath, fileName);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Invoice maker running at http://localhost:${PORT}`);
});
```

**Step 3: Commit**

```bash
git add src/server.ts src/public/index.html
git commit -m "feat: add Express server with web form"
```

---

### Task 8: Integration Test

**Files:**
- Create: `src/integration.test.ts`

**Step 1: Write integration test**

Create `src/integration.test.ts` that:
1. Imports the server logic (or calls the API endpoint)
2. Sends a POST with `{ date: "2026-01-31", hours: 178, rate: 20 }`
3. Verifies a PDF file is created in `output/` with correct name
4. Verifies the file is non-empty

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/integration.test.ts
git commit -m "test: add integration test for PDF generation"
```

---

### Task 9: Manual Smoke Test

**Step 1: Start the server**

Run: `npm start`

**Step 2: Open browser at `http://localhost:3000`**

**Step 3: Fill the form with test data**

- Date: 2026-01-31
- Hours: 178
- Rate: 20

**Step 4: Click "Generate PDF"**

**Step 5: Verify the downloaded PDF**

- File name: `Doe_Invoice_Jan_Client_2026.pdf`
- Layout matches the example
- All computed values are correct:
  - Invoice number: `2026-01`
  - Total: `5 162`
  - Due date: 20 business days from 2026-01-31
  - Amount in words present in EN and UA

**Step 6: Compare side-by-side with `examples/Doe_Invoice_Dec_Client_2025.pdf`**

Fix any layout differences in `src/template.ts`.

**Step 7: Final commit**

```bash
git add -A
git commit -m "chore: finalize invoice maker v1"
```
