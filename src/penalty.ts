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

export function invalidAmountMessage(input: RawPenaltyInput): string {
  return `Invoice ${input.invoiceNo}: cannot read amount "${String(input.invoiceAmount)}"`;
}

export function parsePenaltyInput(input: RawPenaltyInput): PenaltyInput | null {
  const invoiceAmount = parseAmount(input.invoiceAmount);
  return invoiceAmount === null ? null : { ...input, invoiceAmount };
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
