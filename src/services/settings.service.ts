import { db } from "@/lib/db.js";
import { encrypt, decrypt } from "@/lib/crypto.js";
import { HttpError } from "@/lib/httpError.js";
import {
  DEFAULT_CREDITS_PER_PACK,
  DEFAULT_PACK_PRICE,
} from "@/config/pricing.js";

export const SENSITIVE_KEYS = new Set([
  "duitku.apiKey",
  "xendit.apiKey",
  "xendit.callbackToken",
  "anthropic.apiKey",
]);

export const SETTING_KEYS = [
  "payment.provider",
  "duitku.merchantCode",
  "duitku.apiKey",
  "duitku.env",
  "xendit.apiKey",
  "xendit.callbackToken",
  "anthropic.apiKey",
  "anthropic.model",
  "bank.accounts",
  "pricing.packPrice",
  "pricing.creditsPerPack",
] as const;

const DEFAULT_SETTINGS: Record<string, string> = {
  "pricing.packPrice": String(DEFAULT_PACK_PRICE),
  "pricing.creditsPerPack": String(DEFAULT_CREDITS_PER_PACK),
  "anthropic.model": "claude-opus-4-8",
  "duitku.env": "sandbox",
  "bank.accounts": "[]",
  // "" = no automatic gateway (manual transfer only)
  "payment.provider": "",
};

const cache = new Map<string, string>();

export function invalidateSettingsCache(): void {
  cache.clear();
}

export async function getSetting(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const record = await db.setting.findUnique({ where: { key } });
  if (!record) {
    const fallback = DEFAULT_SETTINGS[key];
    if (fallback === undefined) return null;
    cache.set(key, fallback);
    return fallback;
  }
  const value = record.encrypted ? decrypt(record.value) : record.value;
  cache.set(key, value);
  return value;
}

export async function getRequiredSetting(
  key: string,
  missingMessage: string
): Promise<string> {
  const value = await getSetting(key);
  if (!value) {
    throw new HttpError(503, missingMessage);
  }
  return value;
}

export async function setSettings(
  values: Record<string, string>
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    const sensitive = SENSITIVE_KEYS.has(key);
    const stored = sensitive ? encrypt(value) : value;
    await db.setting.upsert({
      where: { key },
      update: { value: stored, encrypted: sensitive },
      create: { key, value: stored, encrypted: sensitive },
    });
  }
  invalidateSettingsCache();
}

export function maskValue(value: string): string {
  return `••••${value.slice(-4)}`;
}

export interface MaskedSetting {
  value: string;
  masked: boolean;
}

export async function getAllSettingsMasked(): Promise<
  Record<string, MaskedSetting>
> {
  const result: Record<string, MaskedSetting> = {};
  for (const key of SETTING_KEYS) {
    result[key] = { value: DEFAULT_SETTINGS[key] ?? "", masked: false };
  }
  const records = await db.setting.findMany();
  for (const record of records) {
    const plain = record.encrypted ? decrypt(record.value) : record.value;
    const sensitive = SENSITIVE_KEYS.has(record.key) || record.encrypted;
    result[record.key] =
      sensitive && plain.length > 0
        ? { value: maskValue(plain), masked: true }
        : { value: plain, masked: false };
  }
  return result;
}

export async function getPackPrice(): Promise<number> {
  const raw = await getSetting("pricing.packPrice");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PACK_PRICE;
}

export async function getCreditsPerPack(): Promise<number> {
  const raw = await getSetting("pricing.creditsPerPack");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_CREDITS_PER_PACK;
}
