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

const MAX_AMOUNT = 1_000_000_000;
const MAX_INPUT_LENGTH = 40;
const SPACE = "[ \u00a0\u202f]";
const PLAIN_AMOUNT = /^(\d+)(?:[.,](\d{0,2}))?$/;
const GROUPED_AMOUNT = /^([1-9]\d{0,2})([.,\u0020\u00a0\u202f])(\d{3}(?:\2\d{3})*)(?:(?!\2)[.,](\d{0,2}))?$/;
const CURRENCY_PREFIX = new RegExp(`^(?:€|EUR)${SPACE}*`, "i");
const CURRENCY_SUFFIX = /(?:€|EUR)$/i;
const TRAILING_SPACE = new RegExp(`${SPACE}+$`);

function validAmount(amount: number): number | null {
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT ? amount : null;
}

// Accepts "5263.50", "5263,50", "3 000", "3,000.50", "3.000,50", "5263.50 EUR",
// "€5263.50". A single separator followed by exactly three digits is a
// thousands separator; whitespace is valid only as a thousands separator.
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") {
    return Math.round(input * 100) / 100 === input ? validAmount(input) : null;
  }
  if (typeof input !== "string") {
    return null;
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return null;
  }
  const trimmed = input.trim();
  const text = CURRENCY_PREFIX.test(trimmed)
    ? trimmed.replace(CURRENCY_PREFIX, "")
    : trimmed.replace(CURRENCY_SUFFIX, "").replace(TRAILING_SPACE, "");
  let intPart: string;
  let decPart: string | undefined;
  const plain = PLAIN_AMOUNT.exec(text);
  if (plain) {
    [, intPart, decPart] = plain;
  } else {
    const grouped = GROUPED_AMOUNT.exec(text);
    if (!grouped) {
      return null;
    }
    intPart = grouped[1] + grouped[3].replace(/[.,\u0020\u00a0\u202f]/g, "");
    decPart = grouped[4];
  }
  return validAmount(Number(`${intPart}.${decPart || "0"}`));
}
