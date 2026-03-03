import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../../src/api-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.status(200).json({ email });
}
