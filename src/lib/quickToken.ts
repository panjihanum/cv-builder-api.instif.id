import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.js";

export type QuickAction = "approve" | "reject";

export function generateToken(action: QuickAction, orderId: string): string {
  return createHmac("sha256", env.QUICK_TOKEN_SECRET)
    .update(`${action}:${orderId}`)
    .digest("hex");
}

export function verifyToken(
  action: QuickAction,
  orderId: string,
  token: string
): boolean {
  const expected = generateToken(action, orderId);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
