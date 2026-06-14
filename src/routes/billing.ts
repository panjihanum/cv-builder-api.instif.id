import { Hono, type Context } from "hono";
import { z } from "zod";
import { env } from "@/lib/env.js";
import { validate } from "@/lib/validation.js";
import { assertUploadedFile, saveUploadedFile } from "@/lib/uploads.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";
import * as orderService from "@/services/payment/order.service.js";
import * as gatewayService from "@/services/payment/gateway.service.js";
import { getPricingConfig } from "@/services/settings.service.js";
import { getBankAccounts } from "@/services/payment/manual.service.js";
import type { WebhookRequest } from "@/services/payment/providers/types.js";

const createOrderSchema = z.object({
  method: z.enum(["MANUAL", "GATEWAY"]),
  packs: z.number().int().min(1),
});

const proofFileRule = {
  mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
  extensions: [".jpg", ".jpeg", ".png", ".pdf"],
  label: "jpg, png, atau pdf",
};

export const billingRoutes = new Hono<AuthEnv>();

/**
 * Konfigurasi harga publik (harga paket + biaya kredit fitur). Tanpa auth agar
 * landing page bisa menampilkan harga sesuai pengaturan admin tiap web.
 */
billingRoutes.get("/pricing", async (c) => {
  return c.json(await getPricingConfig());
});

billingRoutes.get("/credit", requireAuth, async (c) => {
  const credits = await creditService.ensureCredit(c.get("user").sub);
  return c.json({ credits });
});

billingRoutes.get("/orders", requireAuth, async (c) => {
  const items = await orderService.listOrders(c.get("user").sub);
  return c.json({ items });
});

/** Checkout options available to the buyer: manual transfer and/or a gateway. */
billingRoutes.get("/methods", requireAuth, async (c) => {
  const [bankAccounts, gateway] = await Promise.all([
    getBankAccounts(),
    gatewayService.getActiveProvider(),
  ]);
  return c.json({
    manual: bankAccounts.length > 0,
    gateway: gateway?.configured
      ? { id: gateway.id, label: gateway.label }
      : null,
  });
});

billingRoutes.post(
  "/order",
  requireAuth,
  validate("json", createOrderSchema),
  async (c) => {
    const { method, packs } = c.req.valid("json");
    const userId = c.get("user").sub;
    if (method === "GATEWAY") {
      const result = await gatewayService.createGatewayCheckout(userId, packs, {
        callbackBaseUrl: env.PUBLIC_API_URL || new URL(c.req.url).origin,
        returnUrl: env.PUBLIC_APP_URL || env.CORS_ORIGIN.split(",")[0],
      });
      return c.json(result);
    }
    const result = await orderService.createCheckout(userId, "MANUAL", packs);
    return c.json(result);
  }
);

billingRoutes.get("/order/:id", requireAuth, async (c) => {
  const order = await orderService.getOwnedOrder(
    c.get("user").sub,
    c.req.param("id")
  );
  return c.json({ order });
});

billingRoutes.post("/order/:id/proof", requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = assertUploadedFile(body.file, proofFileRule);
  const proofUrl = await saveUploadedFile(file);
  const order = await orderService.attachProof(
    c.get("user").sub,
    c.req.param("id"),
    proofUrl
  );
  return c.json({ order });
});

/** Build a provider-agnostic webhook payload from the raw request. */
async function readWebhook(c: Context): Promise<WebhookRequest> {
  const rawBody = await c.req.text();
  const contentType = c.req.header("content-type") ?? "";
  let body: Record<string, unknown> = {};
  if (rawBody) {
    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        body = {};
      }
    } else {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    }
  }
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { rawBody, body, headers };
}

/**
 * Single webhook endpoint for every gateway. The `:provider` segment selects
 * which provider verifies and interprets the callback (e.g. /billing/webhook/duitku).
 */
billingRoutes.post("/webhook/:provider", async (c) => {
  const request = await readWebhook(c);
  const result = await gatewayService.handleWebhook(
    c.req.param("provider"),
    request
  );
  return c.json(result);
});
