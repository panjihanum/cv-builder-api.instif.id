import type { CvData } from "@/lib/cvData.js";
import type { TemplateTier } from "@/config/pricing.js";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { getCreditCosts } from "@/services/settings.service.js";
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

/**
 * Biaya kredit template, diresolusi dari pengaturan harga admin (DB). Tier-nya
 * tetap di kode, tapi nominal kredit per tier bisa diubah admin tiap web.
 */
export async function getTemplateCreditCost(
  templateId: string
): Promise<number> {
  const tier = getTemplate(templateId).tier;
  const costs = await getCreditCosts();
  return costs.templateTier[tier];
}

export function renderTemplate(templateId: string, data: CvData): string {
  return getTemplate(templateId).render(data);
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
