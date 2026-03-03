import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { kvGet, kvSet, kvDel } from "./kv.js";

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

interface UserRecord {
  passwordHash: string;
  createdAt: string;
}

interface SessionData {
  email: string;
}

export async function registerUser(email: string, password: string): Promise<boolean> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("Password must be at least 8 characters");
  }
  const normalizedEmail = email.toLowerCase().trim();
  const userKey = `user:${normalizedEmail}`;
  const existing = await kvGet<UserRecord>(userKey);
  if (existing) return false;

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user: UserRecord = {
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  await kvSet(userKey, user);
  return true;
}

export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const userKey = `user:${normalizedEmail}`;
  const user = await kvGet<UserRecord>(userKey);
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function createSession(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const session: SessionData = { email };
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
