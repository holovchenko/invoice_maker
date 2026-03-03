# Multi-User Vercel App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the local Express invoice maker into a multi-user Vercel app with magic link auth, per-user settings, and direct PDF download.

**Architecture:** Vercel serverless functions replace Express. Vercel KV stores user data, supplier configs, counters, and sessions. Auth via magic link (Resend + JWT). PDF via puppeteer-core + @sparticuz/chromium. Single HTML SPA with view switching.

**Tech Stack:** Vercel serverless, Vercel KV (@vercel/kv), Resend, jsonwebtoken, puppeteer-core, @sparticuz/chromium, Vitest.

**Design doc:** `docs/plans/2026-03-03-multi-user-vercel-design.md`

---

## Phase 1: Foundation

### Task 1: Project Setup

**Files:**
- Create: `vercel.json`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `tsconfig.json`

**Step 1: Install dependencies**

```bash
npm install @vercel/kv @vercel/node resend jsonwebtoken puppeteer-core @sparticuz/chromium
npm install -D @types/jsonwebtoken vercel
```

**Step 2: Create vercel.json**

```json
{
  "buildCommand": "",
  "outputDirectory": "",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/src/public/index.html" }
  ],
  "functions": {
    "api/generate.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

**Step 3: Create .env.example**

```
KV_REST_API_URL=
KV_REST_API_TOKEN=
RESEND_API_KEY=
JWT_SECRET=change-me-to-random-string
APP_URL=http://localhost:3000
```

**Step 4: Update tsconfig.json**

Add `api` directory to includes. Current rootDir is `src`, but Vercel functions live in `api/`. Change to:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "api/**/*"]
}
```

**Step 5: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "vercel dev",
    "start": "vercel dev",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Note: keep `puppeteer` in dependencies for now (tests may use it). Remove later.

**Step 6: Commit**

```bash
git add vercel.json .env.example package.json package-lock.json tsconfig.json
git commit -m "chore: add Vercel project setup, deps, and env template"
```

---

### Task 2: KV Client Wrapper

**Files:**
- Create: `src/kv.ts`
- Create: `src/kv.test.ts`

**Step 1: Write the failing test**

```typescript
// src/kv.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @vercel/kv
vi.mock("@vercel/kv", () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
  },
}));

import { kv } from "@vercel/kv";
import { kvGet, kvSet, kvDel, kvIncr } from "./kv.js";

describe("kv wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kvGet returns parsed value", async () => {
    vi.mocked(kv.get).mockResolvedValue({ name: "Test" });
    const result = await kvGet<{ name: string }>("key");
    expect(result).toEqual({ name: "Test" });
    expect(kv.get).toHaveBeenCalledWith("key");
  });

  it("kvGet returns null for missing key", async () => {
    vi.mocked(kv.get).mockResolvedValue(null);
    const result = await kvGet("missing");
    expect(result).toBeNull();
  });

  it("kvSet stores value with optional TTL", async () => {
    await kvSet("key", { data: 1 }, 3600);
    expect(kv.set).toHaveBeenCalledWith("key", { data: 1 }, { ex: 3600 });
  });

  it("kvSet stores value without TTL", async () => {
    await kvSet("key", { data: 1 });
    expect(kv.set).toHaveBeenCalledWith("key", { data: 1 }, {});
  });

  it("kvDel removes a key", async () => {
    await kvDel("key");
    expect(kv.del).toHaveBeenCalledWith("key");
  });

  it("kvIncr atomically increments", async () => {
    vi.mocked(kv.incr).mockResolvedValue(5);
    const result = await kvIncr("counter");
    expect(result).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/kv.test.ts`
Expected: FAIL — module `./kv.js` not found

**Step 3: Write minimal implementation**

```typescript
// src/kv.ts
import { kv } from "@vercel/kv";

export async function kvGet<T>(key: string): Promise<T | null> {
  return kv.get<T>(key);
}

export async function kvSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const options = ttlSeconds ? { ex: ttlSeconds } : {};
  await kv.set(key, value, options);
}

export async function kvDel(key: string): Promise<void> {
  await kv.del(key);
}

export async function kvIncr(key: string): Promise<number> {
  return kv.incr(key);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/kv.test.ts`
Expected: 6 tests PASS

**Step 5: Commit**

```bash
git add src/kv.ts src/kv.test.ts
git commit -m "feat: add Vercel KV client wrapper"
```

---

### Task 3: Auth Module (JWT + Session Utils)

**Files:**
- Create: `src/auth.ts`
- Create: `src/auth.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./kv.js", () => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
}));

import { kvGet, kvSet, kvDel } from "./kv.js";
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  createSession,
  getSessionEmail,
  deleteSession,
} from "./auth.js";

// Set JWT_SECRET for tests
process.env.JWT_SECRET = "test-secret-key";

describe("magic link tokens", () => {
  it("creates a valid JWT with email", () => {
    const token = createMagicLinkToken("user@example.com");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifies a valid token and returns email", () => {
    const token = createMagicLinkToken("user@example.com");
    const email = verifyMagicLinkToken(token);
    expect(email).toBe("user@example.com");
  });

  it("returns null for invalid token", () => {
    const email = verifyMagicLinkToken("garbage.token.here");
    expect(email).toBeNull();
  });

  it("returns null for expired token", () => {
    // Create token that's already expired by mocking Date
    const realDateNow = Date.now;
    Date.now = () => new Date("2020-01-01").getTime();
    const token = createMagicLinkToken("user@example.com");
    Date.now = realDateNow;
    const email = verifyMagicLinkToken(token);
    expect(email).toBeNull();
  });
});

describe("sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createSession stores session in KV and returns token", async () => {
    const token = await createSession("user@example.com");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
    expect(kvSet).toHaveBeenCalledWith(
      expect.stringMatching(/^session:/),
      expect.objectContaining({ email: "user@example.com" }),
      expect.any(Number),
    );
  });

  it("getSessionEmail returns email for valid session", async () => {
    vi.mocked(kvGet).mockResolvedValue({ email: "user@example.com", expiresAt: Date.now() + 100000 });
    const email = await getSessionEmail("valid-token");
    expect(email).toBe("user@example.com");
    expect(kvGet).toHaveBeenCalledWith("session:valid-token");
  });

  it("getSessionEmail returns null for missing session", async () => {
    vi.mocked(kvGet).mockResolvedValue(null);
    const email = await getSessionEmail("invalid");
    expect(email).toBeNull();
  });

  it("deleteSession removes session from KV", async () => {
    await deleteSession("token-to-delete");
    expect(kvDel).toHaveBeenCalledWith("session:token-to-delete");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth.test.ts`
Expected: FAIL — module `./auth.js` not found

**Step 3: Write minimal implementation**

```typescript
// src/auth.ts
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { kvGet, kvSet, kvDel } from "./kv.js";

const MAGIC_LINK_EXPIRY = "15m";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is required");
  return secret;
}

export function createMagicLinkToken(email: string): string {
  return jwt.sign({ email }, getJwtSecret(), { expiresIn: MAGIC_LINK_EXPIRY });
}

export function verifyMagicLinkToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { email: string };
    return payload.email;
  } catch {
    return null;
  }
}

interface SessionData {
  email: string;
  expiresAt: number;
}

export async function createSession(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const session: SessionData = {
    email,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  await kvSet(`session:${token}`, session, SESSION_TTL_SECONDS);
  return token;
}

export async function getSessionEmail(token: string): Promise<string | null> {
  const session = await kvGet<SessionData>(`session:${token}`);
  if (!session) return null;
  return session.email;
}

export async function deleteSession(token: string): Promise<void> {
  await kvDel(`session:${token}`);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth.test.ts`
Expected: 7 tests PASS

**Step 5: Commit**

```bash
git add src/auth.ts src/auth.test.ts
git commit -m "feat: add auth module with JWT magic links and KV sessions"
```

---

## Phase 2: Auth API Routes

### Task 4: Login Endpoint

**Files:**
- Create: `api/auth/login.ts`

Vercel serverless function format: default export `(req: VercelRequest, res: VercelResponse)`.

**Step 1: Write the endpoint**

```typescript
// api/auth/login.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { createMagicLinkToken } from "../../src/auth.js";
import { kvGet, kvSet } from "../../src/kv.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const token = createMagicLinkToken(normalizedEmail);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const magicLink = `${appUrl}/api/auth/verify?token=${token}`;

  await resend.emails.send({
    from: "Invoice Maker <noreply@yourdomain.com>",
    to: normalizedEmail,
    subject: "Your login link",
    html: `<p>Click to log in:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p>`,
  });

  return res.status(200).json({ ok: true });
}
```

**Step 2: Commit**

```bash
git add api/auth/login.ts
git commit -m "feat: add magic link login endpoint"
```

---

### Task 5: Verify Endpoint

**Files:**
- Create: `api/auth/verify.ts`

**Step 1: Write the endpoint**

```typescript
// api/auth/verify.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyMagicLinkToken, createSession } from "../../src/auth.js";
import { kvGet, kvSet } from "../../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token is required" });
  }

  const email = verifyMagicLinkToken(token);
  if (!email) {
    return res.status(401).json({ error: "Invalid or expired link" });
  }

  // Open registration: create user if not exists
  const userKey = `user:${email}`;
  const existing = await kvGet(userKey);
  if (!existing) {
    await kvSet(userKey, { createdAt: new Date().toISOString() });
  }

  const sessionToken = await createSession(email);

  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );

  return res.redirect(302, "/");
}
```

**Step 2: Commit**

```bash
git add api/auth/verify.ts
git commit -m "feat: add magic link verify endpoint with session creation"
```

---

### Task 6: Logout + Me Endpoints

**Files:**
- Create: `api/auth/logout.ts`
- Create: `api/auth/me.ts`
- Create: `src/api-helpers.ts` (shared cookie parser + auth check)

**Step 1: Write shared helper**

```typescript
// src/api-helpers.ts
import type { VercelRequest } from "@vercel/node";
import { getSessionEmail } from "./auth.js";

export function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
}

export async function getAuthenticatedEmail(req: VercelRequest): Promise<string | null> {
  const cookies = parseCookies(req);
  const sessionToken = cookies["session"];
  if (!sessionToken) return null;
  return getSessionEmail(sessionToken);
}
```

**Step 2: Write logout endpoint**

```typescript
// api/auth/logout.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteSession } from "../../src/auth.js";
import { parseCookies } from "../../src/api-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookies = parseCookies(req);
  const sessionToken = cookies["session"];
  if (sessionToken) {
    await deleteSession(sessionToken);
  }

  res.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; Max-Age=0");
  return res.status(200).json({ ok: true });
}
```

**Step 3: Write me endpoint**

```typescript
// api/auth/me.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../../src/api-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.status(200).json({ email });
}
```

**Step 4: Commit**

```bash
git add src/api-helpers.ts api/auth/logout.ts api/auth/me.ts
git commit -m "feat: add logout, me endpoints and shared API helpers"
```

---

## Phase 3: Data API Routes

### Task 7: Settings Endpoint (Supplier CRUD)

**Files:**
- Create: `api/settings.ts`

**Step 1: Write the endpoint**

The supplier config schema matches the existing `SupplierConfig` interface from `src/config.ts` but without `fileNamePattern`, `surname`, `customerShort` (those are derived/internal). Users configure: nameEN, nameUA, addressEN, addressUA, registrationCode, signatureEN, signatureUA, bank (beneficiary, sepa, bic, receiver).

```typescript
// api/settings.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet, kvSet } from "../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const key = `supplier:${email}`;

  if (req.method === "GET") {
    const supplier = await kvGet(key);
    return res.status(200).json(supplier || null);
  }

  if (req.method === "PUT") {
    const supplier = req.body;
    if (!supplier || !supplier.nameEN || !supplier.bank?.sepa) {
      return res.status(400).json({ error: "Missing required supplier fields" });
    }
    await kvSet(key, supplier);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

**Step 2: Commit**

```bash
git add api/settings.ts
git commit -m "feat: add settings endpoint for per-user supplier config"
```

---

### Task 8: Customer Endpoint

**Files:**
- Create: `api/customer.ts`

**Step 1: Write the endpoint**

```typescript
// api/customer.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet } from "../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const customer = await kvGet("customer");
  if (!customer) {
    return res.status(404).json({ error: "Customer config not set" });
  }

  return res.status(200).json(customer);
}
```

Note: The shared customer config is seeded manually via KV dashboard or a one-time script. No admin UI needed for 15 users.

**Step 2: Commit**

```bash
git add api/customer.ts
git commit -m "feat: add customer endpoint for shared config"
```

---

### Task 9: Counter Endpoint (KV-Backed Per-User)

**Files:**
- Create: `api/counter.ts`

**Step 1: Write the endpoint**

```typescript
// api/counter.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet, kvIncr } from "../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const key = `counter:${email}`;
  // Get current value without incrementing (for pre-filling the form)
  const current = await kvGet<number>(key);
  const next = (current ?? 0) + 1;

  return res.status(200).json({ next });
}
```

**Step 2: Commit**

```bash
git add api/counter.ts
git commit -m "feat: add counter endpoint for per-user invoice numbering"
```

---

## Phase 4: Core API Migration

### Task 10: PDF Generator Refactor

**Files:**
- Modify: `src/pdf-generator.ts`
- Modify: `src/template.test.ts` (if any PDF tests exist — check first)

**Step 1: Refactor pdf-generator.ts to return Buffer**

The current function launches Puppeteer, saves to disk, returns filepath. Refactor to:
- Use `puppeteer-core` + `@sparticuz/chromium` in production
- Fall back to regular `puppeteer` in local dev (if `@sparticuz/chromium` not available)
- Return `Buffer` instead of writing to disk

```typescript
// src/pdf-generator.ts
import puppeteer from "puppeteer-core";

async function getBrowser() {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    const chromium = await import("@sparticuz/chromium");
    return puppeteer.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }
  // Local dev: use system Chrome or puppeteer's bundled one
  const localPuppeteer = await import("puppeteer");
  return localPuppeteer.default.launch({ headless: true });
}

export async function generatePDFBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
```

**Step 2: Run existing tests to ensure no regressions**

Run: `npx vitest run`
Expected: All 97 tests PASS (pdf-generator has no direct tests; template tests don't use it)

**Step 3: Commit**

```bash
git add src/pdf-generator.ts
git commit -m "refactor: pdf-generator returns Buffer, supports Vercel + local"
```

---

### Task 11: Generate Endpoint

**Files:**
- Create: `api/generate.ts`

This replaces the `POST /api/generate` handler from `src/server.ts`. The logic is the same but reads supplier/customer from KV and increments counter in KV.

**Step 1: Write the endpoint**

```typescript
// api/generate.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet, kvIncr } from "../src/kv.js";
import { renderInvoiceHTML } from "../src/template.js";
import { generatePDFBuffer } from "../src/pdf-generator.js";
import { calculatePenalty } from "../src/penalty.js";
import type { PenaltyInput, PenaltyResult } from "../src/penalty.js";
import { addBusinessDays } from "../src/business-days.js";
import { fetchHolidaysForRange } from "../src/holidays.js";
import { formatAmount, formatDate, generateFileName } from "../src/format.js";
import { amountToWordsEN, amountToWordsUA } from "../src/number-to-words.js";
import type { SupplierConfig, CustomerConfig } from "../src/config.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { date, hours, rate, invoiceNumber: customInvoiceNumber, penalties: penaltyInputs = [] } = req.body;
    const invoiceDate = new Date(date);

    // Load configs from KV
    const supplier = await kvGet<SupplierConfig>(`supplier:${email}`);
    if (!supplier) {
      return res.status(400).json({ error: "Supplier settings not configured. Go to Settings first." });
    }
    const customer = await kvGet<CustomerConfig>("customer");
    if (!customer) {
      return res.status(500).json({ error: "Customer config not set" });
    }

    // Invoice number: use custom or auto-increment
    let invoiceNumber: string;
    if (customInvoiceNumber) {
      invoiceNumber = String(customInvoiceNumber);
    } else {
      const counterKey = `counter:${email}`;
      const next = await kvIncr(counterKey);
      invoiceNumber = String(next);
    }

    const serviceAmount = hours * rate;

    // Collect years for holidays
    const years = new Set<number>();
    years.add(invoiceDate.getFullYear());
    const estimatedEndDate = new Date(invoiceDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + 30);
    years.add(estimatedEndDate.getFullYear());
    for (const p of penaltyInputs) {
      const pInvoiceDate = new Date(p.invoiceDate);
      years.add(pInvoiceDate.getFullYear());
      years.add(pInvoiceDate.getFullYear() + 1);
      years.add(new Date(p.paymentReceivedDate).getFullYear());
    }
    const sortedYears = [...years].sort((a, b) => a - b);
    const holidays = await fetchHolidaysForRange(sortedYears[0], sortedYears[sortedYears.length - 1]);

    const paymentDueDate = addBusinessDays(invoiceDate, 20, holidays);

    const penaltyResults = penaltyInputs.map(
      (p: PenaltyInput) => calculatePenalty(p, holidays),
    );
    const validPenalties = penaltyResults.filter(
      (p: PenaltyResult) => p.delayDays > 0,
    );
    const penaltyTotal = validPenalties.reduce(
      (sum: number, p: PenaltyResult) => sum + p.penaltyAmount, 0,
    );
    const grandTotal = Math.round((serviceAmount + penaltyTotal) * 100) / 100;

    const data = {
      invoiceNumber,
      invoiceDate: formatDate(invoiceDate),
      hours,
      rate: formatAmount(rate),
      serviceAmount: formatAmount(serviceAmount),
      totalAmount: formatAmount(grandTotal),
      totalWordsEN: amountToWordsEN(grandTotal),
      totalWordsUA: amountToWordsUA(grandTotal),
      paymentDueDate: formatDate(paymentDueDate),
      penalties: validPenalties.map((p: PenaltyResult) => ({
        invoiceNo: p.invoiceNo,
        delayDays: p.delayDays,
        penaltyAmount: formatAmount(p.penaltyAmount),
        dueDate: formatDate(p.dueDate),
        actualPaymentDate: formatDate(p.actualPaymentDate),
      })),
    };

    const html = renderInvoiceHTML(data, supplier, customer);
    const pdfBuffer = await generatePDFBuffer(html);
    const fileName = generateFileName(supplier, invoiceDate);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    return res.status(500).json({ error: "Failed to generate PDF" });
  }
}
```

**Step 2: Commit**

```bash
git add api/generate.ts
git commit -m "feat: add generate endpoint (PDF via serverless)"
```

---

### Task 12: Calculate-Penalties Endpoint

**Files:**
- Create: `api/calculate-penalties.ts`

**Step 1: Write the endpoint**

```typescript
// api/calculate-penalties.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { calculatePenalty } from "../src/penalty.js";
import type { PenaltyInput } from "../src/penalty.js";
import { fetchHolidaysForRange } from "../src/holidays.js";
import { formatAmount, formatDate } from "../src/format.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { penalties: penaltyInputs = [] } = req.body;

    const years = new Set<number>();
    for (const p of penaltyInputs) {
      const invoiceDate = new Date(p.invoiceDate);
      years.add(invoiceDate.getFullYear());
      years.add(invoiceDate.getFullYear() + 1);
      years.add(new Date(p.paymentReceivedDate).getFullYear());
    }
    const sortedYears = [...years].sort((a, b) => a - b);
    const holidays = sortedYears.length > 0
      ? await fetchHolidaysForRange(sortedYears[0], sortedYears[sortedYears.length - 1])
      : [];

    const results = penaltyInputs.map((p: PenaltyInput) => {
      const result = calculatePenalty(p, holidays);
      return {
        invoiceNo: result.invoiceNo,
        delayDays: result.delayDays,
        penaltyAmount: formatAmount(result.penaltyAmount),
        dueDate: formatDate(result.dueDate),
        actualPaymentDate: formatDate(result.actualPaymentDate),
      };
    });

    return res.status(200).json({ penalties: results });
  } catch (error) {
    console.error("Penalty calculation error:", error);
    return res.status(500).json({ error: "Failed to calculate penalties" });
  }
}
```

**Step 2: Commit**

```bash
git add api/calculate-penalties.ts
git commit -m "feat: add calculate-penalties endpoint"
```

---

## Phase 5: UI

### Task 13: Login View

**Files:**
- Modify: `src/public/index.html`

**Step 1: Add login view HTML and auth state management**

Add to the top of the `<body>`, before the existing form:

```html
<!-- Login View -->
<div id="login-view" style="display:none; max-width:400px; margin:60px auto; text-align:center;">
  <h1>Invoice Maker</h1>
  <p>Enter your email to receive a login link</p>
  <label for="login-email">Email</label>
  <input type="email" id="login-email" placeholder="you@example.com" required>
  <button id="login-btn" type="button">Send magic link</button>
  <p id="login-message" style="display:none; color:green;"></p>
  <p id="login-error" style="display:none; color:red;"></p>
</div>
```

Add auth initialization JS at the end of the `<script>` block:

```javascript
// Auth state
async function checkAuth() {
  try {
    const resp = await fetch("/api/auth/me");
    if (resp.ok) {
      const { email } = await resp.json();
      showApp(email);
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById("login-view").style.display = "block";
  document.getElementById("app-view").style.display = "none";
}

function showApp(email) {
  document.getElementById("login-view").style.display = "none";
  document.getElementById("app-view").style.display = "block";
  document.getElementById("user-email").textContent = email;
}

document.getElementById("login-btn").addEventListener("click", async function() {
  var email = document.getElementById("login-email").value;
  if (!email) return;
  this.disabled = true;
  try {
    var resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    });
    if (resp.ok) {
      document.getElementById("login-message").textContent = "Check your email for the login link!";
      document.getElementById("login-message").style.display = "block";
      document.getElementById("login-error").style.display = "none";
    } else {
      throw new Error("Failed to send");
    }
  } catch {
    document.getElementById("login-error").textContent = "Failed to send login link. Try again.";
    document.getElementById("login-error").style.display = "block";
  } finally {
    this.disabled = false;
  }
});

// Init
checkAuth();
```

**Step 2: Wrap existing form in an `app-view` div**

Wrap the entire existing form section in:
```html
<div id="app-view" style="display:none;">
  <!-- auth header -->
  <div id="auth-header" style="text-align:right; padding:10px;">
    <span id="user-email"></span>
    <a href="#" id="settings-link">Settings</a>
    <button id="logout-btn" type="button">Logout</button>
  </div>
  <!-- existing form content here -->
</div>
```

Add logout handler:
```javascript
document.getElementById("logout-btn").addEventListener("click", async function() {
  await fetch("/api/auth/logout", { method: "POST" });
  showLogin();
});
```

**Step 3: Run tests to check nothing broke**

Run: `npx vitest run`
Expected: All 97 tests PASS (HTML changes don't affect unit tests)

**Step 4: Commit**

```bash
git add src/public/index.html
git commit -m "feat: add login view with magic link auth flow"
```

---

### Task 14: Settings View

**Files:**
- Modify: `src/public/index.html`

**Step 1: Add settings view HTML**

Inside the `#app-view` div, add a settings panel (hidden by default):

```html
<div id="settings-view" style="display:none; max-width:600px; margin:20px auto;">
  <h2>Supplier Settings</h2>
  <p>Configure your supplier details for invoices.</p>

  <label for="s-nameEN">Name (EN)</label>
  <input type="text" id="s-nameEN" required>

  <label for="s-nameUA">Name (UA)</label>
  <input type="text" id="s-nameUA" required>

  <label for="s-addressEN">Address (EN)</label>
  <input type="text" id="s-addressEN" required>

  <label for="s-addressUA">Address (UA)</label>
  <input type="text" id="s-addressUA" required>

  <label for="s-registrationCode">Registration Code</label>
  <input type="text" id="s-registrationCode" required>

  <label for="s-signatureEN">Signature (EN)</label>
  <input type="text" id="s-signatureEN" required>

  <label for="s-signatureUA">Signature (UA)</label>
  <input type="text" id="s-signatureUA" required>

  <h3>Bank Details</h3>
  <label for="s-bankBeneficiary">Beneficiary</label>
  <input type="text" id="s-bankBeneficiary" required>

  <label for="s-bankSepa">SEPA/IBAN</label>
  <input type="text" id="s-bankSepa" required>

  <label for="s-bankBic">BIC/SWIFT</label>
  <input type="text" id="s-bankBic" required>

  <label for="s-bankReceiver">Receiver Bank</label>
  <input type="text" id="s-bankReceiver" required>

  <label for="s-surname">Surname (for filename)</label>
  <input type="text" id="s-surname" required>

  <label for="s-customerShort">Customer Short Name (for filename)</label>
  <input type="text" id="s-customerShort" required>

  <button id="save-settings-btn" type="button">Save Settings</button>
  <button id="back-to-invoice-btn" type="button">Back to Invoice</button>
  <p id="settings-message" style="display:none;"></p>
</div>
```

**Step 2: Add settings JS logic**

```javascript
// Settings
var settingsFields = [
  "nameEN", "nameUA", "addressEN", "addressUA", "registrationCode",
  "signatureEN", "signatureUA", "surname", "customerShort",
];
var bankFields = ["bankBeneficiary", "bankSepa", "bankBic", "bankReceiver"];

async function loadSettings() {
  var resp = await fetch("/api/settings");
  if (!resp.ok) return null;
  var data = await resp.json();
  if (!data) return null;
  // Fill form
  settingsFields.forEach(function(f) {
    var el = document.getElementById("s-" + f);
    if (el && data[f]) el.value = data[f];
  });
  if (data.bank) {
    document.getElementById("s-bankBeneficiary").value = data.bank.beneficiary || "";
    document.getElementById("s-bankSepa").value = data.bank.sepa || "";
    document.getElementById("s-bankBic").value = data.bank.bic || "";
    document.getElementById("s-bankReceiver").value = data.bank.receiver || "";
  }
  return data;
}

function collectSettings() {
  var obj = {};
  settingsFields.forEach(function(f) {
    obj[f] = document.getElementById("s-" + f).value;
  });
  obj.bank = {
    beneficiary: document.getElementById("s-bankBeneficiary").value,
    sepa: document.getElementById("s-bankSepa").value,
    bic: document.getElementById("s-bankBic").value,
    receiver: document.getElementById("s-bankReceiver").value,
  };
  return obj;
}

document.getElementById("save-settings-btn").addEventListener("click", async function() {
  var settings = collectSettings();
  var resp = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  var msg = document.getElementById("settings-message");
  if (resp.ok) {
    msg.textContent = "Settings saved!";
    msg.style.color = "green";
  } else {
    msg.textContent = "Failed to save settings.";
    msg.style.color = "red";
  }
  msg.style.display = "block";
});

document.getElementById("settings-link").addEventListener("click", function(e) {
  e.preventDefault();
  showSettings();
});

document.getElementById("back-to-invoice-btn").addEventListener("click", function() {
  showInvoiceForm();
});

function showSettings() {
  document.getElementById("settings-view").style.display = "block";
  document.getElementById("invoice-view").style.display = "none";
  loadSettings();
}

function showInvoiceForm() {
  document.getElementById("settings-view").style.display = "none";
  document.getElementById("invoice-view").style.display = "block";
}
```

**Step 3: Modify `showApp` to check if settings exist**

```javascript
async function showApp(email) {
  document.getElementById("login-view").style.display = "none";
  document.getElementById("app-view").style.display = "block";
  document.getElementById("user-email").textContent = email;

  // Check if supplier settings exist
  var settings = await loadSettings();
  if (!settings) {
    showSettings();
  } else {
    showInvoiceForm();
  }
}
```

**Step 4: Commit**

```bash
git add src/public/index.html
git commit -m "feat: add settings view for supplier configuration"
```

---

### Task 15: Invoice Form Updates

**Files:**
- Modify: `src/public/index.html`

**Step 1: Add editable invoice number field**

Add before the date field in the invoice form:

```html
<label for="invoiceNumber">Invoice Number</label>
<input type="text" id="invoiceNumber" name="invoiceNumber" placeholder="Auto">
```

**Step 2: Pre-fill invoice number from counter API**

In the `showApp`/`showInvoiceForm` function:

```javascript
async function loadNextInvoiceNumber() {
  try {
    var resp = await fetch("/api/counter");
    if (resp.ok) {
      var data = await resp.json();
      document.getElementById("invoiceNumber").placeholder = data.next;
      document.getElementById("invoiceNumber").value = "";
    }
  } catch {}
}
```

Call `loadNextInvoiceNumber()` in `showInvoiceForm()`.

**Step 3: Update form submission to include invoiceNumber**

In the generate button handler, add to the request body:

```javascript
var invoiceNumberInput = document.getElementById("invoiceNumber");
var body = {
  date: dateInput.value,
  hours: Number(hoursInput.value),
  rate: Number(rateInput.value),
  penalties: getPenaltyInputs(),
};
if (invoiceNumberInput.value.trim()) {
  body.invoiceNumber = invoiceNumberInput.value.trim();
}
```

**Step 4: Wrap the existing invoice form in `#invoice-view`**

```html
<div id="invoice-view">
  <!-- existing form content -->
</div>
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All 97 tests PASS

**Step 6: Commit**

```bash
git add src/public/index.html
git commit -m "feat: add editable invoice number, connect form to Vercel API"
```

---

## Phase 6: Deploy & Verify

### Task 16: Holiday Cache Fix for Serverless

**Files:**
- Modify: `src/holidays.ts`

The current `holidays.ts` writes cache files to `config/holidays/`. On Vercel serverless, the filesystem is read-only. Wrap the file writes in try-catch to gracefully degrade (always fetch from API, skip caching).

**Step 1: Add try-catch around file operations in holidays.ts**

In `saveCachedHolidays`, wrap the `writeFileSync` in try-catch:

```typescript
export function saveCachedHolidays(...): void {
  try {
    // existing code
  } catch {
    // Silently skip caching on read-only filesystems (Vercel serverless)
  }
}
```

In `loadCachedHolidays`, it already returns `null` on error, which is fine.

**Step 2: Run tests**

Run: `npx vitest run src/holidays.test.ts`
Expected: All 10 tests PASS

**Step 3: Commit**

```bash
git add src/holidays.ts
git commit -m "fix: gracefully handle read-only filesystem for holiday cache"
```

---

### Task 17: Config Module — Export Types Only

**Files:**
- Modify: `src/config.ts`

The `api/generate.ts` imports `SupplierConfig` and `CustomerConfig` types from `src/config.ts`. The existing module loads from files. For Vercel, we only need the type exports. Keep the file functions for backwards compatibility (local dev, tests) but ensure the types are exported.

**Step 1: Verify types are exported**

Check that `SupplierConfig` and `CustomerConfig` interfaces have `export`. If not, add it.

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All 97 tests PASS

**Step 3: Commit (if changes needed)**

```bash
git add src/config.ts
git commit -m "refactor: ensure config types are exported for API routes"
```

---

### Task 18: Seed Script for Customer Config

**Files:**
- Create: `scripts/seed-customer.ts`

One-time script to populate the shared customer config in KV.

**Step 1: Write the seed script**

```typescript
// scripts/seed-customer.ts
import { kvSet } from "../src/kv.js";

const customer = {
  // Fill with actual customer data from config/customer.json
  nameEN: "Company Name",
  locationEN: "City, Country",
  taxId: "RO12345678",
  registrationCode: "J00/0000/0000",
  bankAccount: "RO00BANK0000000000000000",
  bankName: "Bank Name",
  bank: {
    beneficiary: "Company Name SRL",
    account: "RO00BANK0000000000000000",
    bankName: "Bank Name",
  },
};

async function main() {
  await kvSet("customer", customer);
  console.log("Customer config seeded successfully");
}

main().catch(console.error);
```

Run with: `npx tsx scripts/seed-customer.ts` (requires KV env vars)

**Step 2: Commit**

```bash
git add scripts/seed-customer.ts
git commit -m "chore: add seed script for shared customer config in KV"
```

---

### Task 19: Vercel Deployment & Smoke Test

**Step 1: Deploy to Vercel**

```bash
vercel --prod
```

**Step 2: Configure environment variables in Vercel dashboard**

Set: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `RESEND_API_KEY`, `JWT_SECRET`, `APP_URL`

**Step 3: Create Vercel KV store and link to project**

Via Vercel dashboard: Storage → Create KV → Link to project

**Step 4: Run seed script against production KV**

```bash
npx tsx scripts/seed-customer.ts
```

**Step 5: Smoke test**

1. Open the app URL
2. Enter email → receive magic link → click → logged in
3. Fill supplier settings → save
4. Fill invoice form → generate PDF → downloads
5. Verify PDF content is correct
6. Log out → log back in → settings preserved

**Step 6: Commit any fixes from smoke testing**

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1. Foundation | 1-3 | Project setup, KV wrapper, auth module |
| 2. Auth API | 4-6 | Login, verify, logout, me endpoints |
| 3. Data API | 7-9 | Settings, customer, counter endpoints |
| 4. Core Migration | 10-12 | PDF refactor, generate + penalties endpoints |
| 5. UI | 13-15 | Login, settings, updated invoice form |
| 6. Deploy | 16-19 | Serverless fixes, seed script, deployment |

Total: 19 tasks. Existing 97 tests remain passing throughout. New tests for KV wrapper and auth module.
