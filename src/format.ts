const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatAmount(amount: number): string {
  const [intPart, decPart] = amount.toFixed(2).split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (decPart === "00") {
    return formattedInt;
  }
  return `${formattedInt}.${decPart}`;
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function generateFileName(
  date: Date,
  surname: string,
  customerShort: string,
): string {
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${surname}_Invoice_${month}_${customerShort}_${year}.pdf`;
}

const PLAIN_AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;
const GROUPED_AMOUNT = /^([1-9]\d{0,2})([.,])(\d{3}(?:\2\d{3})*)(?:(?!\2)[.,](\d{1,2}))?$/;

// Accepts "5263.50", "5263,50", "3 000", "3,000.50", "3.000,50". A single
// separator followed by exactly three digits is a thousands separator.
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? input : null;
  }
  if (typeof input !== "string") {
    return null;
  }
  const compact = input.replace(/\s/g, "");
  let intPart: string;
  let decPart: string | undefined;
  const plain = PLAIN_AMOUNT.exec(compact);
  if (plain) {
    [, intPart, decPart] = plain;
  } else {
    const grouped = GROUPED_AMOUNT.exec(compact);
    if (!grouped) {
      return null;
    }
    intPart = grouped[1] + grouped[3].replace(/[.,]/g, "");
    decPart = grouped[4];
  }
  const amount = Number(`${intPart}.${decPart ?? "0"}`);
  return amount > 0 ? amount : null;
}
