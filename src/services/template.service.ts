import type { CvData } from "@/lib/cvData.js";
import { TEMPLATE_TIERS, type TemplateTier } from "@/config/pricing.js";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import {
  getCreditCosts,
  getSetting,
  templateOverrideSettingKey,
  templateTierOverrideSettingKey,
} from "@/services/settings.service.js";
import { templates, type TemplateEntry } from "@/services/templates/index.js";

export function listTemplateIds(): string[] {
  return Object.keys(templates);
}

function getTemplate(templateId: string): TemplateEntry {
  const entry = templates[templateId];
  if (!entry) {
    throw new HttpError(
      400,
      `Template tidak ditemukan, pilih salah satu: ${listTemplateIds().join(", ")}`
    );
  }
  return entry;
}

function assertTemplateExists(templateId: string): void {
  getTemplate(templateId);
}

export function getTemplateTier(templateId: string): TemplateTier {
  return getTemplate(templateId).tier;
}

/** Override tier admin dari DB; null jika tidak diset. */
async function getTemplateTierOverride(
  templateId: string
): Promise<TemplateTier | null> {
  const raw = await getSetting(templateTierOverrideSettingKey(templateId));
  if (raw && (TEMPLATE_TIERS as readonly string[]).includes(raw)) {
    return raw as TemplateTier;
  }
  return null;
}

/** Semua override tier admin yang sudah diset (hanya template yang punya override). */
export async function getTemplateTierOverrides(): Promise<
  Record<string, TemplateTier>
> {
  const entries = await Promise.all(
    listTemplateIds().map(async (id) => {
      const override = await getTemplateTierOverride(id);
      return override ? ([id, override] as const) : null;
    })
  );
  return Object.fromEntries(
    entries.filter((e): e is readonly [string, TemplateTier] => e !== null)
  );
}

/**
 * Biaya kredit template, diresolusi dari pengaturan harga admin (DB).
 * Override per-template dicek lebih dulu; jika tidak ada, gunakan biaya tier (bisa override).
 */
export async function getTemplateCreditCost(
  templateId: string
): Promise<number> {
  const template = getTemplate(templateId);
  const overrideRaw = await getSetting(templateOverrideSettingKey(templateId));
  if (overrideRaw !== null) {
    const parsed = Number(overrideRaw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  const tierOverride = await getTemplateTierOverride(templateId);
  const effectiveTier = tierOverride ?? template.tier;
  const costs = await getCreditCosts();
  return costs.templateTier[effectiveTier];
}

/**
 * Override biaya kredit per template yang sudah diatur admin.
 * Hanya template yang punya override yang muncul di sini.
 */
export async function getTemplateOverrides(): Promise<Record<string, number>> {
  const entries = await Promise.all(
    listTemplateIds().map(async (id) => {
      const raw = await getSetting(templateOverrideSettingKey(id));
      if (raw === null) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0
        ? ([id, parsed] as const)
        : null;
    })
  );
  return Object.fromEntries(
    entries.filter((e): e is readonly [string, number] => e !== null)
  );
}

export function renderTemplate(templateId: string, data: CvData): string {
  return getTemplate(templateId).render(data);
}

/**
 * Whether a template is edge-to-edge (sidebar/banner). Full-bleed templates are
 * exported with no page margin; the rest get a vertical page margin so content
 * keeps top/bottom breathing room on every page.
 */
export function isFullBleed(templateId: string): boolean {
  return getTemplate(templateId).fullBleed ?? false;
}

export interface TemplateStat {
  templateId: string;
  usageCount: number;
  wishlistCount: number;
}

/**
 * Aggregate per-template usage (number of CVs using it) and wishlist counts.
 * Usage is derived live from the `cvs` table, so there's nothing extra to keep
 * in sync. Returns an entry for every known template, including zero counts.
 */
export async function getTemplateStats(): Promise<TemplateStat[]> {
  const [usage, wishlist] = await Promise.all([
    db.cv.groupBy({ by: ["templateId"], _count: { _all: true } }),
    db.templateWishlist.groupBy({ by: ["templateId"], _count: { _all: true } }),
  ]);

  const usageById = new Map(
    usage.map((row) => [row.templateId, row._count._all])
  );
  const wishlistById = new Map(
    wishlist.map((row) => [row.templateId, row._count._all])
  );

  return listTemplateIds().map((templateId) => ({
    templateId,
    usageCount: usageById.get(templateId) ?? 0,
    wishlistCount: wishlistById.get(templateId) ?? 0,
  }));
}

/** Template ids the user has wishlisted. */
export async function listWishlist(userId: string): Promise<string[]> {
  const rows = await db.templateWishlist.findMany({
    where: { userId },
    select: { templateId: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => row.templateId);
}

/** Add a template to the user's wishlist (idempotent). */
export async function addToWishlist(
  userId: string,
  templateId: string
): Promise<void> {
  assertTemplateExists(templateId);
  await db.templateWishlist.upsert({
    where: { userId_templateId: { userId, templateId } },
    create: { userId, templateId },
    update: {},
  });
}

/** Remove a template from the user's wishlist (idempotent). */
export async function removeFromWishlist(
  userId: string,
  templateId: string
): Promise<void> {
  await db.templateWishlist.deleteMany({ where: { userId, templateId } });
}
