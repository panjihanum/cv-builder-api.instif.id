import crypto from "node:crypto";
import { env } from "@/lib/env.js";

/**
 * Pulls this app's centrally-managed settings from the instif.id hub. Per the
 * project rule, new flexible config (SMTP, gateway keys, …) lives in the hub
 * dashboard — scoped to the apps it applies to — not in each app's `.env`/DB.
 * Values fetched here OVERRIDE the local Setting table (see settings.service),
 * and a hub outage falls back to whatever local/default values exist, so the
 * app never hard-fails on the network.
 *
 * Mirrors the signed partner pattern used for hub checkout (HMAC SSO_SECRET
 * over the raw body, `x-partner-signature` header).
 */

const APP_ID = "cv-builder";
const PARTNER_SIGNATURE_HEADER = "x-partner-signature";
const CACHE_TTL_MS = 60_000;

let cached: { at: number; values: Record<string, string> } | null = null;
let inflight: Promise<Record<string, string>> | null = null;

/** Online settings sync is available only when the shared hub secret is set. */
export function isHubSettingsConfigured(): boolean {
  return Boolean(env.SSO_SECRET && env.SSO_SECRET.length > 0);
}

function sign(rawBody: string): string {
  return crypto
    .createHmac("sha256", env.SSO_SECRET ?? "")
    .update(rawBody)
    .digest("hex");
}

async function fetchFromHub(): Promise<Record<string, string>> {
  const payload = JSON.stringify({ app: APP_ID });
  try {
    const res = await fetch(`${env.INSTIF_HUB_URL}/api/partner/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [PARTNER_SIGNATURE_HEADER]: sign(payload),
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { settings?: Record<string, string> };
    };
    const values = json.data?.settings;
    if (res.ok && values && typeof values === "object") {
      cached = { at: Date.now(), values };
      return values;
    }
  } catch {
    // Network/hub failure — fall back to the last good cache (or empty).
  }
  return cached?.values ?? {};
}

/**
 * The app's hub settings as a key→value map. Cached for {@link CACHE_TTL_MS};
 * concurrent callers share one in-flight request. Returns `{}` when the hub is
 * not configured or unreachable with no prior cache.
 */
export async function getHubSettings(
  force = false
): Promise<Record<string, string>> {
  if (!isHubSettingsConfigured()) return {};
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.values;
  }
  if (inflight) return inflight;
  inflight = fetchFromHub().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Test/ops helper — drop the in-memory cache so the next read re-fetches. */
export function clearHubSettingsCache(): void {
  cached = null;
  inflight = null;
}
