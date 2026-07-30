import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Cross-app admin SSO between the instif.id hub and the satellite apps
 * (content / news / tech / crm / cv-builder).
 *
 * The hub signs a short-lived token with the shared `SSO_SECRET`; the target
 * app's API verifies it and mints its own session. This file is the single
 * source of truth for the wire format and is copied into every consumer repo
 * (only each repo's formatter differs) — change it here first, then re-copy,
 * or the ecosystem stops agreeing on what a token is.
 *
 * Wire format (v2):
 *
 *   token   = base64url(JSON(claims)) + "." + hex(HMAC-SHA256(base64url part))
 *   claims  = { v, sub, email, role, aud, jti, iat, exp }
 *
 * The signature covers the *encoded* payload, so there is no JSON
 * canonicalisation to get wrong: any edit to the payload changes the signed
 * input.
 *
 * Three properties make a captured token close to worthless, which matters
 * because the token necessarily travels in a URL (browser history, Referer,
 * proxy logs):
 *
 *   - `aud` binds it to one app, so a token meant for news cannot be replayed
 *     against crm even though every app shares one secret;
 *   - `jti` + {@link SsoReplayGuard} make it single-use;
 *   - the TTL is 2 minutes, not 5 — the redirect it serves is immediate.
 */

export const SSO_TOKEN_VERSION = 2;

/** How long a freshly minted token stays valid. The redirect is immediate. */
export const SSO_TOKEN_TTL_MS = 2 * 60 * 1000;

/** Tolerance for clock drift between the hub and a consumer. */
export const SSO_MAX_CLOCK_SKEW_MS = 30 * 1000;

/** Refuse to sign or verify with a secret weak enough to brute-force. */
export const SSO_MIN_SECRET_LENGTH = 16;

/** Every app that may receive a hub SSO token. */
export const SSO_AUDIENCES = [
  "content",
  "news",
  "tech",
  "crm",
  "cv-builder",
] as const;

export type SsoAudience = (typeof SSO_AUDIENCES)[number];

export function isSsoAudience(value: unknown): value is SsoAudience {
  return (
    typeof value === "string" &&
    (SSO_AUDIENCES as readonly string[]).includes(value)
  );
}

export interface SsoClaims {
  /** Token format version. Only {@link SSO_TOKEN_VERSION} is accepted. */
  v: number;
  /** Hub user id. */
  sub: string;
  /** Hub user email, used by consumers to map onto a local account. */
  email: string | null;
  /** Hub role. Only ADMIN is ever issued or accepted. */
  role: "ADMIN";
  /** The one app allowed to redeem this token. */
  aud: SsoAudience;
  /** Random single-use id. */
  jti: string;
  /** Issued-at, epoch ms. */
  iat: number;
  /** Expiry, epoch ms. */
  exp: number;
}

export type SsoVerifyFailure =
  | "not_configured"
  | "malformed"
  | "bad_signature"
  | "unsupported_version"
  | "not_admin"
  | "wrong_audience"
  | "not_yet_valid"
  | "expired"
  | "ttl_too_long"
  | "replayed";

export type SsoVerifyResult =
  | { ok: true; claims: SsoClaims }
  | { ok: false; reason: SsoVerifyFailure };

const PAYLOAD_PATTERN = /^[A-Za-z0-9_-]+$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

function resolveSecret(explicit?: string): string | null {
  const secret = explicit ?? process.env.SSO_SECRET;
  if (!secret || secret.length < SSO_MIN_SECRET_LENGTH) return null;
  return secret;
}

/**
 * Domain separator. `SSO_SECRET` also signs the partner billing channel
 * (`lib/partner.ts`), so every SSO signature is taken over a prefixed input.
 * A signature produced by one protocol can then never be valid in the other,
 * whatever either one is later changed to sign.
 */
const SIGNING_CONTEXT = "instif-sso-v2:";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(SIGNING_CONTEXT + payload)
    .digest("hex");
}

export interface SignSsoTokenInput {
  userId: string;
  email?: string | null;
  role: string;
  audience: SsoAudience;
}

export interface SignSsoTokenOptions {
  secret?: string;
  now?: number;
  ttlMs?: number;
}

/**
 * Mint a token for one app. Throws rather than returning a dud, because every
 * failure here is a misconfiguration or a caller bug, never user input.
 */
export function signSsoToken(
  input: SignSsoTokenInput,
  options: SignSsoTokenOptions = {}
): string {
  const secret = resolveSecret(options.secret);
  if (!secret) {
    throw new Error(
      `SSO_SECRET is not configured, or is shorter than ${SSO_MIN_SECRET_LENGTH} characters`
    );
  }
  if (!input.userId) throw new Error("SSO token requires a user id");
  if (input.role !== "ADMIN") {
    throw new Error("SSO tokens are only issued for ADMIN users");
  }
  if (!isSsoAudience(input.audience)) {
    throw new Error(`Unknown SSO audience: ${String(input.audience)}`);
  }

  const now = options.now ?? Date.now();
  const ttl = options.ttlMs ?? SSO_TOKEN_TTL_MS;
  if (ttl <= 0 || ttl > SSO_TOKEN_TTL_MS) {
    throw new Error(
      `SSO token ttl must be between 1 and ${SSO_TOKEN_TTL_MS}ms`
    );
  }

  const claims: SsoClaims = {
    v: SSO_TOKEN_VERSION,
    sub: input.userId,
    email: input.email ?? null,
    role: "ADMIN",
    aud: input.audience,
    jti: randomBytes(16).toString("hex"),
    iat: now,
    exp: now + ttl,
  };

  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url"
  );
  return `${payload}.${sign(payload, secret)}`;
}

export interface VerifySsoTokenOptions {
  /** The audience this verifier is willing to accept. Required. */
  audience: SsoAudience;
  secret?: string;
  now?: number;
  /** Supply a guard to make tokens single-use. Strongly recommended. */
  replayGuard?: SsoReplayGuard;
}

/**
 * Verify a hub token for one specific audience.
 *
 * Checks run cheapest-first, and the replay guard runs last so an invalid or
 * expired token can never burn a valid `jti`.
 */
export function verifySsoToken(
  token: unknown,
  options: VerifySsoTokenOptions
): SsoVerifyResult {
  const secret = resolveSecret(options.secret);
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!isSsoAudience(options.audience)) {
    return { ok: false, reason: "wrong_audience" };
  }
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "malformed" };
  }

  const separator = token.indexOf(".");
  if (separator <= 0) return { ok: false, reason: "malformed" };

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!PAYLOAD_PATTERN.test(payload) || !SIGNATURE_PATTERN.test(signature)) {
    return { ok: false, reason: "malformed" };
  }

  const expected = sign(payload, secret);
  if (
    !timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    )
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  let claims: SsoClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as SsoClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!claims || typeof claims !== "object") {
    return { ok: false, reason: "malformed" };
  }
  if (claims.v !== SSO_TOKEN_VERSION) {
    return { ok: false, reason: "unsupported_version" };
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    return { ok: false, reason: "malformed" };
  }
  if (typeof claims.jti !== "string" || claims.jti.length === 0) {
    return { ok: false, reason: "malformed" };
  }
  if (!Number.isFinite(claims.iat) || !Number.isFinite(claims.exp)) {
    return { ok: false, reason: "malformed" };
  }
  if (claims.role !== "ADMIN") return { ok: false, reason: "not_admin" };
  if (claims.aud !== options.audience) {
    return { ok: false, reason: "wrong_audience" };
  }

  // A token whose lifetime exceeds the protocol maximum was not minted by a
  // healthy hub, so refuse it however fresh it looks.
  if (claims.exp - claims.iat > SSO_TOKEN_TTL_MS) {
    return { ok: false, reason: "ttl_too_long" };
  }

  const now = options.now ?? Date.now();
  if (claims.iat - now > SSO_MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: "not_yet_valid" };
  }
  if (now > claims.exp + SSO_MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: "expired" };
  }

  if (
    options.replayGuard &&
    !options.replayGuard.consume(
      claims.jti,
      claims.exp + SSO_MAX_CLOCK_SKEW_MS,
      now
    )
  ) {
    return { ok: false, reason: "replayed" };
  }

  return { ok: true, claims: { ...claims, email: claims.email ?? null } };
}

/**
 * Makes each `jti` redeemable exactly once.
 *
 * The store is per-process: exact for a single container (how every
 * *.instif.id API runs today) and degrading to plain TTL enforcement if an API
 * is ever scaled out. Move it to Redis before running more than one replica.
 */
export class SsoReplayGuard {
  private readonly seen = new Map<string, number>();

  /** Returns false when this id has already been redeemed. */
  consume(jti: string, expiresAt: number, now: number = Date.now()): boolean {
    this.prune(now);
    if (this.seen.has(jti)) return false;
    this.seen.set(jti, expiresAt);
    return true;
  }

  /** Entries only ever live as long as the token they guard. */
  private prune(now: number): void {
    for (const [jti, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(jti);
    }
  }

  get size(): number {
    return this.seen.size;
  }

  clear(): void {
    this.seen.clear();
  }
}
