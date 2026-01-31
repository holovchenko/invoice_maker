# Invoice Maker Design

## Overview

CLI-додаток на TypeScript/Node.js з веб-інтерфейсом для генерації PDF-інвойсів.
Запускаєш `npm start` — відкривається локальна сторінка у браузері з формою.
Заповнюєш 3 поля, натискаєш кнопку — отримуєш PDF.

## Tech Stack

- **Node.js + TypeScript**
- **Puppeteer** — рендеринг HTML у PDF
- **Express** — локальний веб-сервер для форми
- **number-to-words** — число прописом (EN)
- **Vitest** — тестування

## Project Structure

```
invoice_maker/
├── src/
│   ├── server.ts          # Express сервер + API endpoint
│   ├── template.ts        # HTML-шаблон інвойсу
│   ├── pdf-generator.ts   # Puppeteer → PDF
│   ├── number-to-words.ts # Число прописом (EN + UA)
│   ├── business-days.ts   # Розрахунок +20 робочих днів
│   └── public/
│       └── index.html     # Форма у браузері
├── output/                # Згенеровані PDF
├── examples/              # Існуючі приклади
├── package.json
└── tsconfig.json
```

## Flow

1. `npm start` → запускає Express на `localhost:3000`, відкриває браузер
2. Заповнюєш форму (дата, години, ціна)
3. Натискаєш "Generate" → POST запит на сервер
4. Сервер генерує HTML з шаблону, Puppeteer рендерить PDF
5. PDF зберігається в `output/` і завантажується у браузер

## Input Fields

| Field | Type | Default |
|-------|------|---------|
| Invoice date | date picker | today |
| Hours | number | 168 |
| Hourly rate (EUR) | number | 29 |

## Computed Values

- **Invoice number**: `YYYY-MM` from invoice date (e.g. `2026-01`)
- **Total amount**: `hours * rate`, formatted with space as thousands separator (e.g. `5 162`)
- **Total in words (EN)**: via `number-to-words` library
- **Total in words (UA)**: custom function
- **Payment due date**: invoice date + 20 business days (skip Sat/Sun only)
- **File name**: `{Surname}_Invoice_{Mon}_{CustomerShort}_{Year}.pdf`

## HTML Template

Exact copy of the example PDF layout — bilingual EN/UA two-column table.

**Dynamic placeholders:**
- `{{invoiceNumber}}` — YYYY-MM
- `{{invoiceDate}}` — DD.MM.YYYY
- `{{hours}}` — quantity
- `{{rate}}` — price per hour, EUR
- `{{totalAmount}}` — formatted total
- `{{totalWordsEN}}` — amount in words (English)
- `{{totalWordsUA}}` — amount in words (Ukrainian)
- `{{paymentDueDate}}` — DD.MM.YYYY

**Static content (from config):**
- Supplier: name, address, tax ID (from config/supplier.json)
- Customer: name, address, bank details (from config/customer.json)
- Bank info for both parties (SEPA, BIC)
- Subject matter / Terms of payment
- Legal text (force majeure, claims, disputes)

## Testing

**Unit tests (Vitest):**
- `business-days.ts` — +20 business days skips weekends
- `number-to-words.ts` — EN + UA conversion, edge cases
- Amount formatting with space separator
- Invoice number generation from date
- File name generation

**Integration test:**
- POST request with params → verify PDF file created in `output/`
