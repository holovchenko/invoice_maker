import { addBusinessDays, subtractBusinessDays } from "./business-days.js";
import { parseAmount } from "./format.js";

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

export type RawPenaltyInput = Omit<PenaltyInput, "invoiceAmount"> & {
  readonly invoiceAmount: unknown;
};

const MAX_SHOWN_LENGTH = 40;

function isScalar(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

export function invalidAmountMessage(input: RawPenaltyInput): string {
  const { invoiceNo, invoiceAmount } = input;
  const no = isScalar(invoiceNo) ? String(invoiceNo).slice(0, MAX_SHOWN_LENGTH) : "?";
  let shown: string;
  if (isScalar(invoiceAmount)) {
    shown = `"${String(invoiceAmount).slice(0, MAX_SHOWN_LENGTH)}"`;
  } else {
    shown = invoiceAmount === undefined || invoiceAmount === null ? "missing" : "not a number";
  }
  return `Invoice ${no}: invalid amount ${shown}`;
}

export function parsePenaltyInput(input: RawPenaltyInput): PenaltyInput | null {
  const invoiceAmount = parseAmount(input.invoiceAmount);
  return invoiceAmount === null ? null : { ...input, invoiceAmount };
}

export function isPenaltyRow(row: unknown): row is RawPenaltyInput {
  return typeof row === "object" && row !== null;
}

export function parsePenaltyInputs(
  raw: unknown,
): { inputs: PenaltyInput[] } | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: "Penalties must be a list" };
  }
  const inputs: PenaltyInput[] = [];
  for (const row of raw) {
    if (!isPenaltyRow(row)) {
      return { error: "Invalid penalty row" };
    }
    const input = parsePenaltyInput(row);
    if (input === null) {
      return { error: invalidAmountMessage(row) };
    }
    inputs.push(input);
  }
  return { inputs };
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
