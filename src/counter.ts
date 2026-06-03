import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = path.join(__dirname, "..", "config", "counter.json");

interface CounterData {
  next: number;
}

function readCounter(): CounterData {
  if (!fs.existsSync(COUNTER_PATH)) {
    return { next: 1 };
  }
  const raw = fs.readFileSync(COUNTER_PATH, "utf-8");
  return JSON.parse(raw) as CounterData;
}

function writeCounter(data: CounterData): void {
  fs.writeFileSync(COUNTER_PATH, JSON.stringify(data, null, 2) + "\n");
}

export function nextInvoiceNumber(): string {
  const data = readCounter();
  const num = data.next;
  writeCounter({ next: num + 1 });
  return String(num);
}

// Sync the counter after a manually entered invoice number so the next
// auto-number continues from it. Advance-only: never moves backward, to
// avoid re-issuing numbers already used.
export function bumpCounterTo(used: number): void {
  const data = readCounter();
  const nextAfter = used + 1;
  if (nextAfter > data.next) {
    writeCounter({ next: nextAfter });
  }
}
