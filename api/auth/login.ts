import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { createMagicLinkToken } from "../../src/auth.js";
import { kvGet, kvSet } from "../../src/kv.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const token = createMagicLinkToken(normalizedEmail);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const magicLink = `${appUrl}/api/auth/verify?token=${token}`;

  await resend.emails.send({
    from: "Invoice Maker <noreply@yourdomain.com>",
    to: normalizedEmail,
    subject: "Your login link",
    html: `<p>Click to log in:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p>`,
  });

  return res.status(200).json({ ok: true });
}
