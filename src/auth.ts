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
