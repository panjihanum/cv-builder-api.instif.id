import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as templateService from "@/services/template.service.js";
import * as settingsService from "@/services/settings.service.js";
import { templates } from "@/services/templates/index.js";
import { TEMPLATE_TIERS } from "@/config/pricing.js";

export const adminTemplateRoutes = new Hono<AuthEnv>();

/** Daftar semua template beserta tier, biaya tier, override tier, dan override harga per template. */
adminTemplateRoutes.get("/", async (c) => {
  const [costs, overrides, tierOverrides, stats] = await Promise.all([
    settingsService.getCreditCosts(),
    templateService.getTemplateOverrides(),
    templateService.getTemplateTierOverrides(),
    templateService.getTemplateStats(),
  ]);

  const statsById = new Map(stats.map((s) => [s.templateId, s]));

  const items = Object.entries(templates).map(([id, entry]) => {
    const tierOverride = tierOverrides[id] ?? null;
    const effectiveTier = tierOverride ?? entry.tier;
    const tierCost = costs.templateTier[effectiveTier];
    const overrideCost = overrides[id] ?? null;
    const stat = statsById.get(id);
    return {
      id,
      tier: entry.tier,
      tierOverride,
      tierCost,
      overrideCost,
      effectiveCost: overrideCost !== null ? overrideCost : tierCost,
      usageCount: stat?.usageCount ?? 0,
      wishlistCount: stat?.wishlistCount ?? 0,
    };
  });

  return c.json({ items });
});

const updateSchema = z.record(
  z.string(),
  z.union([z.number().int().min(0), z.null()])
);

/** Set atau hapus override harga per template. null = hapus override (pakai tier). */
adminTemplateRoutes.put("/", validate("json", updateSchema), async (c) => {
  const updates = c.req.valid("json");
  const payload: Record<string, string> = {};

  for (const [templateId, cost] of Object.entries(updates)) {
    const key = settingsService.templateOverrideSettingKey(templateId);
    if (cost === null) {
      await settingsService.deleteSettingIfExists(key);
    } else {
      payload[key] = String(cost);
    }
  }

  if (Object.keys(payload).length > 0) {
    await settingsService.setSettings(payload);
  }

  return c.json({ ok: true });
});

const tierUpdateSchema = z.record(
  z.string(),
  z.union([z.enum(TEMPLATE_TIERS), z.null()])
);

/** Set atau hapus override tier per template. null = hapus override (kembali ke tier bawaan). */
adminTemplateRoutes.patch(
  "/tiers",
  validate("json", tierUpdateSchema),
  async (c) => {
    const updates = c.req.valid("json");
    const payload: Record<string, string> = {};

    for (const [templateId, tier] of Object.entries(updates)) {
      const key = settingsService.templateTierOverrideSettingKey(templateId);
      if (tier === null) {
        await settingsService.deleteSettingIfExists(key);
      } else {
        payload[key] = tier;
      }
    }

    if (Object.keys(payload).length > 0) {
      await settingsService.setSettings(payload);
    }

    return c.json({ ok: true });
  }
);
