import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as settingsService from "@/services/settings.service.js";

const updateSettingsSchema = z.record(z.string(), z.string());

export const adminSettingsRoutes = new Hono<AuthEnv>();

adminSettingsRoutes.get("/", async (c) => {
  const settings = await settingsService.getAllSettingsMasked();
  return c.json({ settings });
});

adminSettingsRoutes.put(
  "/",
  validate("json", updateSettingsSchema),
  async (c) => {
    await settingsService.setSettings(c.req.valid("json"));
    const settings = await settingsService.getAllSettingsMasked();
    return c.json({ settings });
  }
);
