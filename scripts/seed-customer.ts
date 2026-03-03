import { kvSet } from "../src/kv.js";

// Fill with actual customer data before running.
// Run with: npx tsx scripts/seed-customer.ts
// Requires KV_REST_API_URL and KV_REST_API_TOKEN env vars.
const customer = {
  nameEN: "EXAMPLE COMPANY SRL",
  locationEN: "City, District 1\nExample street no 1, 1st floor",
  taxId: "RO00000000",
  registrationCode: "J00/0000/2024",
  bankAccount: "RO00XXXX0000000000000000",
  bankName: "EXAMPLE BANK",
  bank: {
    beneficiary: "EXAMPLE COMPANY",
    account: "RO00XXXX0000000000000000",
    bankName: "Example Bank",
  },
};

async function main() {
  await kvSet("customer", customer);
  console.log("Customer config seeded successfully");
}

main().catch(console.error);
