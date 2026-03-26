import type { VercelRequest, VercelResponse } from "@vercel/node";
import { registerUser, createSession, normalizeEmail, isValidEmail } from "../../src/auth.js";
import { setSessionCookie } from "../../src/api-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    console.warn("[register] missing email or password");
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    console.warn(`[register] invalid email: ${email}`);
    return res.status(400).json({ error: "Invalid email address" });
  }

  try {
    const created = await registerUser(normalized, password);
    if (!created) {
      console.info(`[register] duplicate email: ${normalized}`);
      return res.status(409).json({ error: "Email already registered" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    console.error(`[register] error for ${normalized}:`, err);
    return res.status(400).json({ error: message });
  }

  const sessionToken = await createSession(normalized);
  setSessionCookie(res, sessionToken);

  console.info(`[register] success: ${normalized}`);
  return res.status(201).json({ ok: true });
}
