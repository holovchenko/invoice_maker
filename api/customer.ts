import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet } from "../src/kv.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const customer = await kvGet("customer");
  if (!customer) {
    return res.status(404).json({ error: "Customer config not set" });
  }

  return res.status(200).json(customer);
}
