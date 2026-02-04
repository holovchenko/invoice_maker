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

export function generateInvoiceNumber(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
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
