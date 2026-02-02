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
