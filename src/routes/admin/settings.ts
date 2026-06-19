import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as settingsService from "@/services/settings.service.js";
import { verifySmtpConnection } from "@/lib/email.js";

const updateSettingsSchema = z.record(z.string(), z.string());

export const adminSettingsRoutes = new Hono<AuthEnv>();

// Verify SMTP credentials without sending mail, for the dashboard test button.
adminSettingsRoutes.post("/smtp/test", async (c) => {
  const result = await verifySmtpConnection();
  return c.json(result);
});

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
