import { Hono } from "hono";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as whatsappService from "@/services/whatsapp.service.js";

export const adminWhatsappRoutes = new Hono<AuthEnv>();

adminWhatsappRoutes.get("/status", (c) =>
  c.json({ status: whatsappService.getStatus() })
);

adminWhatsappRoutes.get("/qr", async (c) => {
  const result = await whatsappService.getQrDataUrl();
  return c.json(result);
});

adminWhatsappRoutes.post("/logout", async (c) => {
  await whatsappService.logout();
  return c.json({ ok: true });
});
