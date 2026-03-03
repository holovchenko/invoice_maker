import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyMagicLinkToken, createSession } from "../../src/auth.js";
import { kvGet, kvSet } from "../../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token is required" });
  }

  const email = verifyMagicLinkToken(token);
  if (!email) {
    return res.status(401).json({ error: "Invalid or expired link" });
  }

  // Open registration: create user if not exists
  const userKey = `user:${email}`;
  const existing = await kvGet(userKey);
  if (!existing) {
    await kvSet(userKey, { createdAt: new Date().toISOString() });
  }

  const sessionToken = await createSession(email);

  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );

  return res.redirect(302, "/");
}
