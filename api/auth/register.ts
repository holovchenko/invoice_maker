import type { VercelRequest, VercelResponse } from "@vercel/node";
import { registerUser, createSession } from "../../src/auth.js";
import { setSessionCookie } from "../../src/api-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const created = await registerUser(email, password);
    if (!created) {
      return res.status(409).json({ error: "Email already registered" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return res.status(400).json({ error: message });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const sessionToken = await createSession(normalizedEmail);
  setSessionCookie(res, sessionToken);

  return res.status(201).json({ ok: true });
}
