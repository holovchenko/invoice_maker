import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = path.join(__dirname, "..", "config", "counter.json");

describe("nextInvoiceNumber", () => {
  let originalContent: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(COUNTER_PATH)) {
      originalContent = fs.readFileSync(COUNTER_PATH, "utf-8");
    } else {
      originalContent = null;
    }
  });

  afterEach(() => {
    if (originalContent !== null) {
      fs.writeFileSync(COUNTER_PATH, originalContent);
    } else if (fs.existsSync(COUNTER_PATH)) {
      fs.unlinkSync(COUNTER_PATH);
    }
  });

  it("starts at 1 when no counter file exists", async () => {
    if (fs.existsSync(COUNTER_PATH)) {
      fs.unlinkSync(COUNTER_PATH);
    }
    // Fresh import to avoid module cache issues
    const { nextInvoiceNumber } = await import("./counter.js");
    const num = nextInvoiceNumber();
    expect(num).toBe("1");
  });

  it("increments on each call", async () => {
    fs.writeFileSync(COUNTER_PATH, JSON.stringify({ next: 10 }) + "\n");
    const { nextInvoiceNumber } = await import("./counter.js");
    const first = nextInvoiceNumber();
    const second = nextInvoiceNumber();
    expect(first).toBe("10");
    expect(second).toBe("11");
  });

  it("persists the counter to file", async () => {
    fs.writeFileSync(COUNTER_PATH, JSON.stringify({ next: 5 }) + "\n");
    const { nextInvoiceNumber } = await import("./counter.js");
    nextInvoiceNumber();
    const data = JSON.parse(fs.readFileSync(COUNTER_PATH, "utf-8"));
    expect(data.next).toBe(6);
  });
});
