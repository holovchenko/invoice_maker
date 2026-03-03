import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchHolidays,
  fetchHolidaysForRange,
  loadCachedHolidays,
  saveCachedHolidays,
  clearMemoryCache,
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

  it("re-throws non-ENOENT errors", () => {
    const syntaxError = new SyntaxError("Unexpected token");
    vi.mocked(readFileSync).mockImplementation(() => {
      throw syntaxError;
    });

    expect(() => loadCachedHolidays(2026, "/tmp/config")).toThrow(syntaxError);
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
    clearMemoryCache();
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

describe("fetchHolidaysForRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    clearMemoryCache();
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

    const result = await fetchHolidaysForRange(2026, 2026, "/tmp/config");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(["2026-01-01"]);
  });
});
