# Romanian Public Holidays in Business Days Calculation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Calculate invoice due dates (20 business days) excluding Romanian public holidays, not just weekends.

**Architecture:** Fetch holidays from Nager.Date API (`/api/v3/publicholidays/{year}/RO`), cache results in local JSON files. On API failure, fall back to cached data. Pass holiday dates to `addBusinessDays()` which checks each day against weekends AND holidays.

**Tech Stack:** TypeScript, Node.js native `fetch`, Vitest, existing project structure.

---

### Task 1: Create `holidays.ts` module with types and cache logic

**Files:**
- Create: `src/holidays.ts`
- Create: `src/holidays.test.ts`

**Step 1: Write the failing tests**

In `src/holidays.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchHolidays,
  loadCachedHolidays,
  saveCachedHolidays,
  NAGER_API_BASE,
} from "./holidays";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

const SAMPLE_API_RESPONSE = [
  { date: "2026-01-01", localName: "Anul Nou", name: "New Year's Day" },
  { date: "2026-01-02", localName: "Anul Nou", name: "Day after New Year's Day" },
  { date: "2026-04-17", localName: "Vinerea Mare", name: "Good Friday" },
  { date: "2026-04-19", localName: "Paștele", name: "Easter Sunday" },
  { date: "2026-04-20", localName: "Paștele", name: "Easter Monday" },
  { date: "2026-05-01", localName: "Ziua Muncii", name: "Labour Day" },
  { date: "2026-06-01", localName: "Ziua Copilului", name: "Children's Day" },
  { date: "2026-06-07", localName: "Rusaliile", name: "Whit Sunday" },
  { date: "2026-06-08", localName: "Rusaliile", name: "Whit Monday" },
  { date: "2026-08-15", localName: "Adormirea Maicii Domnului", name: "Assumption of Mary" },
  { date: "2026-11-30", localName: "Sfântul Andrei", name: "St. Andrew's Day" },
  { date: "2026-12-01", localName: "Ziua Națională", name: "National Day" },
  { date: "2026-12-25", localName: "Crăciunul", name: "Christmas Day" },
  { date: "2026-12-26", localName: "Crăciunul", name: "St. Stephen's Day" },
];

describe("saveCachedHolidays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates directory and writes JSON file", () => {
    const holidays = ["2026-01-01", "2026-01-02"];
    vi.mocked(existsSync).mockReturnValue(false);

    saveCachedHolidays(2026, holidays, "/tmp/config");

    expect(mkdirSync).toHaveBeenCalledWith(
      path.join("/tmp/config", "holidays"),
      { recursive: true },
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      path.join("/tmp/config", "holidays", "romania-2026.json"),
      JSON.stringify(holidays, null, 2),
      "utf-8",
    );
  });
});

describe("loadCachedHolidays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads and parses cached JSON file", () => {
    const holidays = ["2026-01-01", "2026-01-02"];
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(holidays));

    const result = loadCachedHolidays(2026, "/tmp/config");

    expect(result).toEqual(holidays);
    expect(readFileSync).toHaveBeenCalledWith(
      path.join("/tmp/config", "holidays", "romania-2026.json"),
      "utf-8",
    );
  });

  it("returns null when cache file does not exist", () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });

    const result = loadCachedHolidays(2026, "/tmp/config");

    expect(result).toBeNull();
  });
});

describe("fetchHolidays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetches holidays from API and caches them", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_API_RESPONSE,
    } as Response);
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await fetchHolidays(2026, "/tmp/config");

    expect(fetch).toHaveBeenCalledWith(
      `${NAGER_API_BASE}/2026/RO`,
    );
    expect(result).toEqual(SAMPLE_API_RESPONSE.map((h) => h.date));
    expect(writeFileSync).toHaveBeenCalled();
  });

  it("falls back to cache when API fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    const cached = ["2026-01-01", "2026-01-02"];
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(cached));

    const result = await fetchHolidays(2026, "/tmp/config");

    expect(result).toEqual(cached);
  });

  it("falls back to cache when API returns non-ok status", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const cached = ["2026-01-01"];
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(cached));

    const result = await fetchHolidays(2026, "/tmp/config");

    expect(result).toEqual(cached);
  });

  it("returns empty array when API fails and no cache exists", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    vi.mocked(readFileSync).mockImplementation(() => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });

    const result = await fetchHolidays(2026, "/tmp/config");

    expect(result).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/holidays.test.ts`
Expected: FAIL — module `./holidays` does not exist.

**Step 3: Write minimal implementation**

In `src/holidays.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const NAGER_API_BASE = "https://date.nager.at/api/v3/publicholidays";

interface NagerHoliday {
  readonly date: string;
  readonly localName: string;
  readonly name: string;
}

function getConfigDir(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, "..", "config");
}

function getCachePath(year: number, configDir: string): string {
  return path.join(configDir, "holidays", `romania-${year}.json`);
}

export function saveCachedHolidays(
  year: number,
  holidays: ReadonlyArray<string>,
  configDir?: string,
): void {
  const dir = configDir ?? getConfigDir();
  const holidaysDir = path.join(dir, "holidays");
  mkdirSync(holidaysDir, { recursive: true });
  writeFileSync(
    getCachePath(year, dir),
    JSON.stringify(holidays, null, 2),
    "utf-8",
  );
}

export function loadCachedHolidays(
  year: number,
  configDir?: string,
): ReadonlyArray<string> | null {
  const dir = configDir ?? getConfigDir();
  try {
    const raw = readFileSync(getCachePath(year, dir), "utf-8");
    return JSON.parse(raw) as ReadonlyArray<string>;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function fetchFromApi(year: number): Promise<ReadonlyArray<string>> {
  const response = await fetch(`${NAGER_API_BASE}/${year}/RO`);
  if (!response.ok) {
    throw new Error(`API returned status ${response.status}`);
  }
  const data = (await response.json()) as ReadonlyArray<NagerHoliday>;
  return data.map((h) => h.date);
}

export async function fetchHolidays(
  year: number,
  configDir?: string,
): Promise<ReadonlyArray<string>> {
  const dir = configDir ?? getConfigDir();
  try {
    const holidays = await fetchFromApi(year);
    saveCachedHolidays(year, holidays, dir);
    return holidays;
  } catch {
    const cached = loadCachedHolidays(year, dir);
    return cached ?? [];
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/holidays.test.ts`
Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/holidays.ts src/holidays.test.ts
git commit -m "feat: add holidays module with Nager.Date API and local cache fallback"
```

---

### Task 2: Update `addBusinessDays` to accept holidays

**Files:**
- Modify: `src/business-days.ts`
- Modify: `src/business-days.test.ts`

**Step 1: Update existing tests and add new holiday tests**

Add to `src/business-days.test.ts` — new tests at the end of the describe block:

```typescript
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
  // Same as existing "adds 20 business days to a Monday" test
  const result = addBusinessDays(new Date(2026, 0, 5), 20, []);
  expect(result).toEqual(new Date(2026, 1, 2));
});

it("works without holidays parameter (backward compatible)", () => {
  const result = addBusinessDays(new Date(2026, 0, 5), 20);
  expect(result).toEqual(new Date(2026, 1, 2));
});
```

**Step 2: Run tests to verify new tests fail**

Run: `npx vitest run src/business-days.test.ts`
Expected: New holiday tests FAIL (holidays parameter not handled).

**Step 3: Update implementation**

Replace `src/business-days.ts` with:

```typescript
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addBusinessDays(
  startDate: Date,
  days: number,
  holidays: ReadonlyArray<string> = [],
): Date {
  const holidaySet = new Set(holidays);
  const result = new Date(startDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(formatDateKey(result));
    if (!isWeekend && !isHoliday) {
      added++;
    }
  }

  return result;
}
```

**Step 4: Run tests to verify all pass**

Run: `npx vitest run src/business-days.test.ts`
Expected: All 10 tests PASS.

**Step 5: Commit**

```bash
git add src/business-days.ts src/business-days.test.ts
git commit -m "feat: support public holidays in business days calculation"
```

---

### Task 3: Integrate holidays into server

**Files:**
- Modify: `src/server.ts:4,26-31`

**Step 1: Update server to fetch holidays before calculating due date**

In `src/server.ts`, add import at line 4:

```typescript
import { fetchHolidays } from "./holidays";
```

Replace lines 28-31 (inside the POST handler):

```typescript
    const { date, hours, rate } = req.body;
    const invoiceDate = new Date(date);
    const totalAmount = hours * rate;
    const holidays = await fetchHolidays(invoiceDate.getFullYear());
    const paymentDueDate = addBusinessDays(invoiceDate, 20, holidays);
```

Note: if the 20 business days span into the next year, holidays from the next year won't be included. This is acceptable because Romanian holidays in late December (25, 26) would only matter if the invoice date is in early December, and the due date would land in early January — Jan 1 and Jan 2 holidays ARE in the same year's data. If needed later, this can be enhanced to fetch both years.

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

**Step 3: Manual smoke test**

Run: `npx tsx src/server.ts`
Open: `http://localhost:3000`
Generate an invoice and verify the due date skips Romanian holidays.

**Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat: integrate Romanian holidays into invoice due date calculation"
```

---

### Task 4: Handle year boundary edge case

**Files:**
- Modify: `src/server.ts:28-32`
- Modify: `src/holidays.ts` (add `fetchHolidaysForRange`)

**Step 1: Write failing test**

Add to `src/holidays.test.ts`:

```typescript
describe("fetchHolidaysForRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetches holidays for both years when they differ", async () => {
    const year1Holidays = [{ date: "2026-12-25", localName: "Crăciunul", name: "Christmas Day" }];
    const year2Holidays = [{ date: "2027-01-01", localName: "Anul Nou", name: "New Year's Day" }];

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => year1Holidays,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => year2Holidays,
      } as Response);
    vi.mocked(existsSync).mockReturnValue(false);

    const { fetchHolidaysForRange } = await import("./holidays");
    const result = await fetchHolidaysForRange(2026, 2027, "/tmp/config");

    expect(result).toEqual(["2026-12-25", "2027-01-01"]);
  });

  it("fetches only once when years are the same", async () => {
    const holidays = [{ date: "2026-01-01", localName: "Anul Nou", name: "New Year's Day" }];
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => holidays,
    } as Response);
    vi.mocked(existsSync).mockReturnValue(false);

    const { fetchHolidaysForRange } = await import("./holidays");
    const result = await fetchHolidaysForRange(2026, 2026, "/tmp/config");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(["2026-01-01"]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/holidays.test.ts`
Expected: FAIL — `fetchHolidaysForRange` not exported.

**Step 3: Add `fetchHolidaysForRange` to `src/holidays.ts`**

```typescript
export async function fetchHolidaysForRange(
  startYear: number,
  endYear: number,
  configDir?: string,
): Promise<ReadonlyArray<string>> {
  if (startYear === endYear) {
    return fetchHolidays(startYear, configDir);
  }
  const [first, second] = await Promise.all([
    fetchHolidays(startYear, configDir),
    fetchHolidays(endYear, configDir),
  ]);
  return [...first, ...second];
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/holidays.test.ts`
Expected: All tests PASS.

**Step 5: Update server to use `fetchHolidaysForRange`**

In `src/server.ts`, change the import:

```typescript
import { fetchHolidaysForRange } from "./holidays";
```

Update the handler to estimate the end year (20 business days ~ 28 calendar days):

```typescript
    const { date, hours, rate } = req.body;
    const invoiceDate = new Date(date);
    const totalAmount = hours * rate;
    const estimatedEndDate = new Date(invoiceDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + 30);
    const holidays = await fetchHolidaysForRange(
      invoiceDate.getFullYear(),
      estimatedEndDate.getFullYear(),
    );
    const paymentDueDate = addBusinessDays(invoiceDate, 20, holidays);
```

**Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add src/holidays.ts src/holidays.test.ts src/server.ts
git commit -m "feat: handle year boundary when fetching holidays for due date"
```

---

### Task 5: Run full test suite and verify coverage

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

**Step 2: Check coverage**

Run: `npx vitest run --coverage`
Expected: 80%+ coverage on `holidays.ts` and `business-days.ts`.

**Step 3: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final cleanup for Romanian holidays feature"
```
