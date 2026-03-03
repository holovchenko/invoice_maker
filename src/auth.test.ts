import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./kv.js", () => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
}));

import { kvGet, kvSet, kvDel } from "./kv.js";
import {
  registerUser,
  verifyPassword,
  createSession,
  getSessionEmail,
  deleteSession,
} from "./auth.js";

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user and stores password hash", async () => {
    vi.mocked(kvGet).mockResolvedValue(null);
    const result = await registerUser("user@example.com", "password123");
    expect(result).toBe(true);
    expect(kvSet).toHaveBeenCalledWith(
      "user:user@example.com",
      expect.objectContaining({
        passwordHash: expect.any(String),
        createdAt: expect.any(String),
      }),
    );
    const storedUser = vi.mocked(kvSet).mock.calls[0][1] as { passwordHash: string };
    expect(storedUser.passwordHash).not.toBe("password123");
    expect(storedUser.passwordHash.startsWith("$2")).toBe(true);
  });

  it("returns false for duplicate email", async () => {
    vi.mocked(kvGet).mockResolvedValue({ passwordHash: "existing", createdAt: "2024-01-01" });
    const result = await registerUser("user@example.com", "password123");
    expect(result).toBe(false);
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("throws for password shorter than 8 characters", async () => {
    vi.mocked(kvGet).mockResolvedValue(null);
    await expect(registerUser("user@example.com", "short")).rejects.toThrow(
      "Password must be at least 8 characters",
    );
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("normalizes email to lowercase", async () => {
    vi.mocked(kvGet).mockResolvedValue(null);
    await registerUser("User@Example.COM", "password123");
    expect(kvGet).toHaveBeenCalledWith("user:user@example.com");
    expect(kvSet).toHaveBeenCalledWith(
      "user:user@example.com",
      expect.any(Object),
    );
  });
});

describe("verifyPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for correct password", async () => {
    // Use real bcrypt to create a hash for testing
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correct-password", 10);
    vi.mocked(kvGet).mockResolvedValue({ passwordHash: hash, createdAt: "2024-01-01" });
    const result = await verifyPassword("user@example.com", "correct-password");
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correct-password", 10);
    vi.mocked(kvGet).mockResolvedValue({ passwordHash: hash, createdAt: "2024-01-01" });
    const result = await verifyPassword("user@example.com", "wrong-password");
    expect(result).toBe(false);
  });

  it("returns false for non-existent user", async () => {
    vi.mocked(kvGet).mockResolvedValue(null);
    const result = await verifyPassword("nobody@example.com", "password");
    expect(result).toBe(false);
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
    vi.mocked(kvGet).mockResolvedValue({ email: "user@example.com" });
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
