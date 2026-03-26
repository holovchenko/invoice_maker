import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyPassword, createSession, normalizeEmail, isValidEmail } from "../../src/auth.js";
import { setSessionCookie } from "../../src/api-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const valid = await verifyPassword(normalized, password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const sessionToken = await createSession(normalized);
  setSessionCookie(res, sessionToken);

  return res.status(200).json({ ok: true });
}
