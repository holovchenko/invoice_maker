import { describe, it, expect, vi, beforeEach } from "vitest";

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
