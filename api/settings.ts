import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet, kvSet } from "../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const email = await getAuthenticatedEmail(req);
    if (!email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const key = `supplier:${email}`;

    if (req.method === "GET") {
      const supplier = await kvGet(key);
      return res.status(200).json(supplier || null);
    }

    if (req.method === "PUT") {
      const supplier = req.body;
      if (!supplier || !supplier.nameEN || !supplier.bank?.sepa) {
        console.warn(`[settings] missing required fields for ${email}`);
        return res.status(400).json({ error: "Missing required supplier fields" });
      }
      await kvSet(key, supplier);
      console.info(`[settings] updated for ${email}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[settings] error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
