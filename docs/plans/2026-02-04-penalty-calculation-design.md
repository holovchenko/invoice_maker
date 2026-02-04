# Penalty Calculation for Late Payments

## Overview

Add automatic penalty calculation to the invoice maker based on the contract
clause: 0.1% per day for late payments, capped at the outstanding debt amount.
Penalties appear as additional rows in the invoice table after the main service
line.

## Business Logic

**Formula:** `penalty = invoiceAmount × 0.001 × delayDays`

**Algorithm per penalty row:**

1. User inputs: invoice number, invoice send date, invoice amount, actual
   payment received date
2. **Due date** = invoice send date + 20 business days (existing
   `addBusinessDays` logic, accounting for weekends and Romanian holidays)
3. **SEPA adjustment:** subtract 1 business day from the received date (Monday
   receipt → Friday payment; Tuesday receipt → Monday payment)
4. **Delay days** = `actualPaymentDate - dueDate` in **calendar days** (contract
   says "per day" without qualification)
5. **Penalty** = `invoiceAmount × 0.001 × delayDays`, rounded to 2 decimal
   places
6. **Cap:** penalty cannot exceed invoice amount (contract: "without being able
   to exceed the outstanding debt")
7. If `delayDays <= 0` — no penalty, row is ignored

## Web Form Changes

Existing fields remain unchanged: invoice date, hours, rate.

**New "Penalties" block** below existing fields:

- **"+ Add Penalty"** button adds a row with 4 fields:
  - **Invoice No** — text input (e.g. `2025-11`)
  - **Invoice Date** — date picker (send date of that invoice)
  - **Invoice Amount (EUR)** — number input (total of that invoice)
  - **Payment Received** — date picker (actual date funds were credited)
- **"×"** button on each row to remove it
- Below each row — auto-calculated read-only preview:
  - Due date (invoice date + 20 business days)
  - Actual payment date (received - 1 business day, SEPA)
  - Days of delay
  - Penalty amount (EUR)

Total at the bottom updates automatically: `(hours × rate) + sum(penalties)`.

## PDF Template Changes

Penalty rows appear after the main service row in the table:

| # | Description / Опис | Quantity | Price, EUR | Amount, EUR |
|---|---|---|---|---|
| 1 | IT services... | 168 | 20 | 3 360 |
| 2 | Penalty for invoice 2025-11 / Пеня за інвойс 2025-11 | 19 days of delay | 63.84 | 63.84 |
| 3 | Penalty for invoice 2025-12 / Пеня за інвойс 2025-12 | 12 days of delay | 40.32 | 40.32 |

**Row format** (matches real invoice #17 pattern):
- Sequential numbering (2, 3, 4...)
- Quantity = `"{N} days of delay"` (informational text, not multiplied)
- Price and Amount = same penalty amount
- Description = bilingual: `"Penalty for invoice {No} / Пеня за інвойс {No}"`

**Total to pay** — grand total (services + penalties) in words EN and UA.
**Payment due date** — calculated from current invoice date, as before.

## Architecture

### New module: `src/penalty.ts`

- `calculatePenalty(invoiceDate, invoiceAmount, paymentReceivedDate, holidays)`
- `subtractBusinessDays(date, days, holidays)` — reverse of existing
  `addBusinessDays`, used for SEPA adjustment
- Tests: `src/penalty.test.ts`

### Changes to existing files

| File | Changes |
|---|---|
| `src/public/index.html` | Penalties block with dynamic rows, JS for add/remove and preview calculation |
| `src/server.ts` | Endpoint accepts `penalties[]` array, calls `calculatePenalty` for each |
| `src/template.ts` | Dynamic table rows: 1 service row + N penalty rows. Total = sum of all |
| `src/template.test.ts` | New tests for template with penalties |
| `src/business-days.ts` | Add `subtractBusinessDays` (or extend existing function for negative values) |
| `src/number-to-words.ts` | Support cents: split into integer and fractional parts |

### No changes needed

`config.ts`, `format.ts`, `pdf-generator.ts`, `holidays.ts`

## Number-to-Words: Cents Support

Penalties produce fractional amounts (e.g. 5 044.24). Split into integer and
fractional parts:

- EN: `"five thousand forty-four euros and twenty-four cents"`
- UA: `"п'ять тисяч сорок чотири євро двадцять чотири центи"` (cents, not
  kopiyky, since currency is EUR)
- If cents = 0, omit fractional part (preserve current behavior)

## Edge Cases

| Situation | Behavior |
|---|---|
| Payment on time or early (delay ≤ 0) | Penalty row ignored, not added to invoice |
| Penalty exceeds invoice amount | Cap penalty at invoice amount |
| Received on Monday | SEPA adjustment → Friday |
| Received on Saturday/Sunday | Should not happen (bank closed), but subtract 1 business day as usual |
| No penalty rows added | Invoice generated as currently, no changes |
| Fractional main amount (hours × rate) | Unlikely with integer hours/rate, but supported at number-to-words level |
