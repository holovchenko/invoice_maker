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
