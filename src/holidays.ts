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
