# Multi-User Vercel App Design

## Problem

The invoice maker runs locally. 15 people need to generate invoices through a shared web app, each with their own supplier config and invoice counter. The admin (server operator) should not see generated invoices.

## Decisions

- **Auth**: Magic link via email (Resend). Open registration — first login creates account.
- **Storage**: Vercel KV (Redis). No encryption needed — PDFs are not stored, rates are entered in the browser.
- **PDF**: `puppeteer-core` + `@sparticuz/chromium` in serverless function. Direct download, nothing persisted.
- **Customer**: Shared config, readable by all users. Managed via env or admin endpoint.
- **Invoice number**: Auto-increment per user as default, but editable in the form.

## Architecture

### API Routes (Vercel serverless functions)

```
POST /api/auth/login     → send magic link (Resend)
GET  /api/auth/verify    → verify JWT token, create session
POST /api/auth/logout    → delete session
GET  /api/auth/me        → current user info

GET/PUT /api/settings    → per-user supplier config
GET     /api/customer    → shared customer config (read-only)
GET     /api/counter     → next invoice number for current user

POST /api/generate              → PDF generation + download
POST /api/calculate-penalties   → penalty preview (no side effects)
```

### Data Model (Vercel KV)

| Key | Value | Scope |
|-----|-------|-------|
| `customer` | `{ nameEN, nameUA, location, taxId, registrationCode, bankName, bankSwift, bankAccount }` | Shared |
| `user:{email}` | `{ createdAt }` | Per user |
| `supplier:{email}` | `{ nameEN, nameUA, addressEN, addressUA, registrationCode, bankName, bankSwift, bankAccount }` | Per user |
| `counter:{email}` | `{ next: N }` | Per user |
| `session:{token}` | `{ email, expiresAt }` | Per session |

### Auth Flow

1. User enters email → `POST /api/auth/login`
2. Server generates JWT (email + 15 min expiry), sends magic link via Resend
3. User clicks link → `GET /api/auth/verify?token=<jwt>`
4. Server validates JWT, creates session token in KV (TTL 30 days)
5. Session token set as httpOnly cookie
6. If `user:{email}` doesn't exist → create it (open registration)
7. All protected endpoints: read cookie → lookup session in KV → extract email

### UI Flow

Single HTML page with view switching (no framework):

1. **Login view**: email input + "Send magic link" button
2. **Settings view**: supplier config form (required on first visit)
3. **Invoice form**: existing form + editable invoice number field + auth header
4. **Header**: user email, Settings link, Logout button

### PDF Generation

- Replace `puppeteer` with `puppeteer-core` + `@sparticuz/chromium`
- `pdf-generator.ts` returns Buffer instead of writing to disk
- Serverless function config: `maxDuration: 30`
- Existing `renderInvoiceHTML()` reused without changes

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `KV_REST_API_URL` | Vercel KV connection |
| `KV_REST_API_TOKEN` | Vercel KV auth |
| `RESEND_API_KEY` | Email delivery |
| `JWT_SECRET` | Magic link token signing |
| `APP_URL` | Base URL for magic links |

## File Changes

### Modified

- `src/public/index.html` → add login/settings views, auth state, editable invoice number
- `src/pdf-generator.ts` → `@sparticuz/chromium` adapter, return Buffer
- `src/config.ts` → read from KV instead of files
- `src/counter.ts` → KV-backed per-user counter with atomic increment

### New

- `api/auth/login.ts` — magic link sender
- `api/auth/verify.ts` — token verification + session creation
- `api/auth/logout.ts` — session deletion
- `api/auth/me.ts` — current user info
- `api/generate.ts` — PDF endpoint (moved from Express route)
- `api/calculate-penalties.ts` — penalty preview (moved from Express route)
- `api/settings.ts` — supplier CRUD
- `api/customer.ts` — shared customer config
- `api/counter.ts` — next invoice number
- `src/auth.ts` — JWT utils, session middleware
- `src/kv.ts` — Vercel KV client wrapper
- `vercel.json` — routing + function config

### Unchanged

- `src/template.ts` — HTML template
- `src/penalty.ts` — penalty calculation
- `src/business-days.ts` — business day math
- `src/format.ts` — formatting utilities
- `src/number-to-words.ts` — number to words
- `src/holidays.ts` — holiday fetching (API + cache still works on serverless via KV or in-memory)

## Privacy Model

- PDFs are generated in memory and returned as direct download — never stored
- Rates and hours are entered in the browser form, sent only for PDF generation
- Supplier configs stored in KV are not sensitive (business registration data)
- Admin can see supplier configs and customer config, but never sees invoice amounts or PDFs
