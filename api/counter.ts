import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet } from "../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = await getAuthenticatedEmail(req);
    if (!email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const key = `counter:${email}`;
    const current = await kvGet<number>(key);
    const next = (current ?? 0) + 1;

    return res.status(200).json({ next });
  } catch (err) {
    console.error("[counter] error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
