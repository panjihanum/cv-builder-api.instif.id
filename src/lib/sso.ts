import { createHmac } from "node:crypto";
import { env } from "@/lib/env.js";

/**
 * Verifies an SSO token issued by the instif.id hub.
 *
 * Token format (mirrors instif.id/src/lib/sso.ts):
 *   base64url(JSON{ payload: "userId:role:issuedAtMs", sig: hex(HMAC-SHA256(payload)) })
 *
 * Valid only when the signature matches the shared SSO_SECRET, the token is
 * younger than 5 minutes, and the hub role is ADMIN.
 */
const SSO_TTL_MS = 5 * 60 * 1000;

export interface SSOPayload {
  userId: string;
  role: string;
  iat: number;
}

export function verifySSOToken(token: string): SSOPayload | null {
  const secret = env.SSO_SECRET;
  if (!secret) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8")
    ) as { payload?: string; sig?: string };
    if (
      typeof decoded.payload !== "string" ||
      typeof decoded.sig !== "string"
    ) {
      return null;
    }

    const expected = createHmac("sha256", secret)
      .update(decoded.payload)
      .digest("hex");

    if (expected.length !== decoded.sig.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ decoded.sig.charCodeAt(i);
    }
    if (diff !== 0) return null;

    const [userId, role, iatStr] = decoded.payload.split(":");
    const iat = Number.parseInt(iatStr ?? "", 10);
    if (!userId || !role || Number.isNaN(iat)) return null;
    if (Date.now() - iat > SSO_TTL_MS) return null;
    if (role !== "ADMIN") return null;

    return { userId, role, iat };
  } catch {
    return null;
  }
}
