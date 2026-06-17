import { db } from "@/lib/db.js";
import { encrypt, decrypt } from "@/lib/crypto.js";
import { HttpError } from "@/lib/httpError.js";
import {
  CREDIT_COSTS,
  DEFAULT_CREDITS_PER_PACK,
  DEFAULT_MAX_PACKS_PER_ORDER,
  DEFAULT_ORIGINAL_PACK_PRICE,
  DEFAULT_PACK_PRICE,
  TEMPLATE_TIERS,
  type TemplateTier,
} from "@/config/pricing.js";

/** Setting key untuk biaya kredit satu tier template. */
export function templateTierSettingKey(tier: TemplateTier): string {
  return `pricing.cost.template.${tier}`;
}

/** Setting key untuk override harga kredit per template spesifik. */
export function templateOverrideSettingKey(templateId: string): string {
  return `pricing.cost.templateOverride.${templateId}`;
}

/** Setting key untuk override tier per template spesifik. */
export function templateTierOverrideSettingKey(templateId: string): string {
  return `pricing.tier.override.${templateId}`;
}

const AI_COST_KEYS = {
  aiParse: "pricing.cost.aiParse",
  aiSectionImprove: "pricing.cost.aiSectionImprove",
  aiPolish: "pricing.cost.aiPolish",
  aiTranslate: "pricing.cost.aiTranslate",
} as const;

export const SENSITIVE_KEYS = new Set([
  "duitku.apiKey",
  "xendit.apiKey",
  "xendit.callbackToken",
  "anthropic.apiKey",
  "storage.s3.accessKeyId",
  "storage.s3.secretAccessKey",
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
  "manual.methods",
  "bank.accounts",
  "pricing.packPrice",
  "pricing.originalPackPrice",
  "pricing.creditsPerPack",
  "pricing.maxPacksPerOrder",
  ...TEMPLATE_TIERS.map(templateTierSettingKey),
  AI_COST_KEYS.aiParse,
  AI_COST_KEYS.aiSectionImprove,
  AI_COST_KEYS.aiPolish,
  AI_COST_KEYS.aiTranslate,
  "notification.phone",
  "template.default",
  "storage.provider",
  "storage.s3.bucket",
  "storage.s3.region",
  "storage.s3.accessKeyId",
  "storage.s3.secretAccessKey",
  "storage.s3.endpoint",
  "storage.s3.publicUrl",
] as const;

const DEFAULT_SETTINGS: Record<string, string> = {
  "storage.provider": "local",
  "storage.s3.region": "ap-southeast-1",
  "pricing.packPrice": String(DEFAULT_PACK_PRICE),
  "pricing.originalPackPrice": String(DEFAULT_ORIGINAL_PACK_PRICE),
  "pricing.creditsPerPack": String(DEFAULT_CREDITS_PER_PACK),
  "pricing.maxPacksPerOrder": String(DEFAULT_MAX_PACKS_PER_ORDER),
  ...Object.fromEntries(
    TEMPLATE_TIERS.map((tier) => [
      templateTierSettingKey(tier),
      String(CREDIT_COSTS.templateTier[tier]),
    ])
  ),
  [AI_COST_KEYS.aiParse]: String(CREDIT_COSTS.aiParse),
  [AI_COST_KEYS.aiSectionImprove]: String(CREDIT_COSTS.aiSectionImprove),
  [AI_COST_KEYS.aiPolish]: String(CREDIT_COSTS.aiPolish),
  [AI_COST_KEYS.aiTranslate]: String(CREDIT_COSTS.aiTranslate),
  "anthropic.model": "claude-opus-4-8",
  "duitku.env": "sandbox",
  "manual.methods": "[]",
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

/** Hapus setting dari DB agar kembali ke default. No-op jika tidak ada. */
export async function deleteSettingIfExists(key: string): Promise<void> {
  await db.setting.deleteMany({ where: { key } });
  cache.delete(key);
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

/** Template default yang dipilih admin, atau null jika belum diset. */
export async function getDefaultTemplateId(): Promise<string | null> {
  return getSetting("template.default");
}

/** Set template default. Hapus setting (null) untuk kembali ke template pertama. */
export async function setDefaultTemplateId(
  templateId: string | null
): Promise<void> {
  if (templateId === null) {
    await deleteSettingIfExists("template.default");
  } else {
    await setSettings({ "template.default": templateId });
  }
}

/**
 * Baca setting bernilai angka, jatuh ke `fallback` bila kosong/tidak valid.
 * `allowZero` dipakai untuk biaya yang boleh 0 (mis. template gratis / AI gratis).
 */
async function getNumberSetting(
  key: string,
  fallback: number,
  { allowZero = false }: { allowZero?: boolean } = {}
): Promise<number> {
  const raw = await getSetting(key);
  const parsed = Number(raw);
  const min = allowZero ? 0 : 1;
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export interface CreditCosts {
  templateTier: Record<TemplateTier, number>;
  aiParse: number;
  aiSectionImprove: number;
  aiPolish: number;
  aiTranslate: number;
}

export interface PricingConfig {
  packPrice: number;
  originalPackPrice: number;
  creditsPerPack: number;
  maxPacksPerOrder: number;
  costs: CreditCosts;
}

/** Biaya kredit per fitur (template per tier + aksi AI), resolusi dari DB. */
export async function getCreditCosts(): Promise<CreditCosts> {
  const [tierEntries, aiParse, aiSectionImprove, aiPolish, aiTranslate] =
    await Promise.all([
      Promise.all(
        TEMPLATE_TIERS.map(
          async (tier) =>
            [
              tier,
              await getNumberSetting(
                templateTierSettingKey(tier),
                CREDIT_COSTS.templateTier[tier],
                { allowZero: true }
              ),
            ] as const
        )
      ),
      getNumberSetting(AI_COST_KEYS.aiParse, CREDIT_COSTS.aiParse, {
        allowZero: true,
      }),
      getNumberSetting(
        AI_COST_KEYS.aiSectionImprove,
        CREDIT_COSTS.aiSectionImprove,
        { allowZero: true }
      ),
      getNumberSetting(AI_COST_KEYS.aiPolish, CREDIT_COSTS.aiPolish, {
        allowZero: true,
      }),
      getNumberSetting(AI_COST_KEYS.aiTranslate, CREDIT_COSTS.aiTranslate, {
        allowZero: true,
      }),
    ]);
  return {
    templateTier: Object.fromEntries(tierEntries) as Record<
      TemplateTier,
      number
    >,
    aiParse,
    aiSectionImprove,
    aiPolish,
    aiTranslate,
  };
}

/**
 * Konfigurasi harga lengkap untuk frontend (paket + semua biaya kredit).
 * Dipakai endpoint publik `GET /billing/pricing` agar tampilan harga di web
 * selalu mengikuti pengaturan admin, bukan nilai hardcode.
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  const [
    packPrice,
    originalPackPrice,
    creditsPerPack,
    maxPacksPerOrder,
    costs,
  ] = await Promise.all([
    getPackPrice(),
    getNumberSetting("pricing.originalPackPrice", DEFAULT_ORIGINAL_PACK_PRICE),
    getCreditsPerPack(),
    getNumberSetting("pricing.maxPacksPerOrder", DEFAULT_MAX_PACKS_PER_ORDER),
    getCreditCosts(),
  ]);
  return {
    packPrice,
    originalPackPrice,
    creditsPerPack,
    maxPacksPerOrder,
    costs,
  };
}
