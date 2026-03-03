import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionEmail, SESSION_TTL_SECONDS } from "./auth.js";

export function setSessionCookie(res: VercelResponse, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
}

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
