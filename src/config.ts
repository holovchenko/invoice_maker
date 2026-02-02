import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface SupplierBank {
  readonly beneficiary: string;
  readonly sepa: string;
  readonly bic: string;
  readonly receiver: string;
}

export interface SupplierConfig {
  readonly nameEN: string;
  readonly nameUA: string;
  readonly addressEN: string;
  readonly addressUA: string;
  readonly registrationCode: string;
  readonly signatureEN: string;
  readonly signatureUA: string;
  readonly bank: SupplierBank;
  readonly fileNamePattern: string;
  readonly surname: string;
  readonly customerShort: string;
}

export interface CustomerBank {
  readonly beneficiary: string;
  readonly account: string;
  readonly bankName: string;
}

export interface CustomerConfig {
  readonly nameEN: string;
  readonly locationEN: string;
  readonly taxId: string;
  readonly registrationCode: string;
  readonly bankAccount: string;
  readonly bankName: string;
  readonly bank: CustomerBank;
}

const REQUIRED_SUPPLIER_FIELDS: ReadonlyArray<string> = [
  "nameEN", "nameUA", "addressEN", "addressUA", "registrationCode",
  "signatureEN", "signatureUA", "bank", "fileNamePattern", "surname", "customerShort",
];

const REQUIRED_SUPPLIER_BANK_FIELDS: ReadonlyArray<string> = [
  "beneficiary", "sepa", "bic", "receiver",
];

const REQUIRED_CUSTOMER_FIELDS: ReadonlyArray<string> = [
  "nameEN", "locationEN", "taxId", "registrationCode",
  "bankAccount", "bankName", "bank",
];

const REQUIRED_CUSTOMER_BANK_FIELDS: ReadonlyArray<string> = [
  "beneficiary", "account", "bankName",
];

function validateFields(
  obj: Record<string, unknown>,
  fields: ReadonlyArray<string>,
  context: string,
): void {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null) {
      throw new Error(`Missing required field "${field}" in ${context}`);
    }
  }
}

function getConfigDir(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, "..", "config");
}

export function loadSupplierConfig(configDir?: string): SupplierConfig {
  const dir = configDir ?? getConfigDir();
  const filePath = path.join(dir, "supplier.json");

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    validateFields(raw, REQUIRED_SUPPLIER_FIELDS, "supplier.json");
    validateFields(
      raw.bank as Record<string, unknown>,
      REQUIRED_SUPPLIER_BANK_FIELDS,
      "supplier.json bank",
    );
    return raw as unknown as SupplierConfig;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Supplier config not found at ${filePath}. Copy config/supplier.example.json to config/supplier.json and fill in your details.`);
    }
    throw error;
  }
}

export function loadCustomerConfig(configDir?: string): CustomerConfig {
  const dir = configDir ?? getConfigDir();
  const filePath = path.join(dir, "customer.json");

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    validateFields(raw, REQUIRED_CUSTOMER_FIELDS, "customer.json");
    validateFields(
      raw.bank as Record<string, unknown>,
      REQUIRED_CUSTOMER_BANK_FIELDS,
      "customer.json bank",
    );
    return raw as unknown as CustomerConfig;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Customer config not found at ${filePath}. Copy config/customer.example.json to config/customer.json and fill in your details.`);
    }
    throw error;
  }
}
