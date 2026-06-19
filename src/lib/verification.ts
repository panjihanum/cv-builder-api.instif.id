import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db.js";

/** Email-verification tokens live for 24 hours and are single-use. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh single-use verification token for `email`. Only the SHA-256
 * hash is persisted, so a database leak cannot be used to verify accounts.
 */
export async function createVerificationToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.verificationToken.create({
    data: {
      identifier: email.toLowerCase(),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

export type VerificationResult =
  | { status: "valid"; email: string }
  | { status: "invalid" }
  | { status: "expired" };

/**
 * Consumes a verification token. Returns the verified email on success, or a
 * reason the token cannot be used. A valid token is marked consumed so it can
 * never be replayed.
 */
export async function consumeVerificationToken(
  token: string
): Promise<VerificationResult> {
  const record = await db.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.consumed) return { status: "invalid" };
  if (record.expiresAt.getTime() < Date.now()) return { status: "expired" };
  await db.verificationToken.update({
    where: { id: record.id },
    data: { consumed: true },
  });
  return { status: "valid", email: record.identifier };
}
