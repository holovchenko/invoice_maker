import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteSession } from "../../src/auth.js";
import { parseCookies } from "../../src/api-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cookies = parseCookies(req);
    const sessionToken = cookies["session"];
    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    res.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    console.info("[logout] success");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[logout] error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
