import type { VercelRequest } from "@vercel/node";
import { getSessionEmail } from "./auth.js";

export function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
}

export async function getAuthenticatedEmail(req: VercelRequest): Promise<string | null> {
  const cookies = parseCookies(req);
  const sessionToken = cookies["session"];
  if (!sessionToken) return null;
  return getSessionEmail(sessionToken);
}
