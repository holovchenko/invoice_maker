import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

export const NAGER_API_BASE = "https://date.nager.at/api/v3/publicholidays";

// In-memory cache for serverless environments (read-only filesystem)
const memoryCache = new Map<number, ReadonlyArray<string>>();

export function clearMemoryCache(): void {
  memoryCache.clear();
}

interface NagerHoliday {
  readonly date: string;
  readonly localName: string;
  readonly name: string;
}

function getConfigDir(): string {
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
  try {
    const dir = configDir ?? getConfigDir();
    const holidaysDir = path.join(dir, "holidays");
    mkdirSync(holidaysDir, { recursive: true });
    writeFileSync(
      getCachePath(year, dir),
      JSON.stringify(holidays, null, 2),
      "utf-8",
    );
  } catch {
    // Silently skip caching on read-only filesystems (Vercel serverless)
  }
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
  // Check in-memory cache first (survives across requests in same serverless instance)
  const memoryCached = memoryCache.get(year);
  if (memoryCached) return memoryCached;

  const dir = configDir ?? getConfigDir();
  try {
    const holidays = await fetchFromApi(year);
    memoryCache.set(year, holidays);
    saveCachedHolidays(year, holidays, dir);
    return holidays;
  } catch {
    const cached = loadCachedHolidays(year, dir);
    const result = cached ?? [];
    if (result.length > 0) memoryCache.set(year, result);
    return result;
  }
}

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
