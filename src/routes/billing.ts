import { Hono, type Context } from "hono";
import { z } from "zod";
import { env } from "@/lib/env.js";
import { validate } from "@/lib/validation.js";
import { assertUploadedFile, saveUploadedFile } from "@/lib/uploads.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";
import * as orderService from "@/services/payment/order.service.js";
import * as gatewayService from "@/services/payment/gateway.service.js";
import * as hubService from "@/services/payment/hub.service.js";
import {
  getPricingConfig,
  getDefaultTemplateId,
} from "@/services/settings.service.js";
import {
  getTemplateOverrides,
  getTemplateTierOverrides,
} from "@/services/template.service.js";
import { getActiveMethods } from "@/services/payment/manual.service.js";
import { notifyManualProofUploaded } from "@/services/paymentNotification.service.js";
import type { WebhookRequest } from "@/services/payment/providers/types.js";

const createOrderSchema = z.object({
  method: z.enum(["MANUAL", "GATEWAY"]),
  packs: z.number().int().min(1),
  refCode: z.string().optional(),
});

const proofFileRule = {
  mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
  extensions: [".jpg", ".jpeg", ".png", ".pdf"],
  label: "jpg, png, atau pdf",
};

/**
 * URL tempat gateway memulangkan user setelah bayar. Diarahkan ke halaman
 * /billing (tempat user top-up), bukan root, supaya user langsung melihat
 * status order & saldo kreditnya.
 */
function buildPaymentReturnUrl(): string {
  const base = (env.PUBLIC_APP_URL || env.CORS_ORIGIN.split(",")[0] || "")
    .trim()
    .replace(/\/+$/, "");
  return `${base}/billing`;
}

export const billingRoutes = new Hono<AuthEnv>();

/**
 * Konfigurasi harga publik (harga paket + biaya kredit fitur). Tanpa auth agar
 * landing page bisa menampilkan harga sesuai pengaturan admin tiap web.
 * Termasuk override harga per template jika admin mengaturnya.
 */
billingRoutes.get("/pricing", async (c) => {
  const [config, templateOverride, templateTierOverride, defaultTemplateId] =
    await Promise.all([
      getPricingConfig(),
      getTemplateOverrides(),
      getTemplateTierOverrides(),
      getDefaultTemplateId(),
    ]);
  return c.json({
    ...config,
    defaultTemplateId: defaultTemplateId ?? undefined,
    costs: { ...config.costs, templateOverride, templateTierOverride },
  });
});

billingRoutes.get("/credit", requireAuth, async (c) => {
  const credits = await creditService.ensureCredit(c.get("user").sub);
  return c.json({ credits });
});

billingRoutes.get("/orders", requireAuth, async (c) => {
  const items = await orderService.listOrders(c.get("user").sub);
  return c.json({ items });
});

/**
 * Checkout options available to the buyer: manual transfer and/or online
 * payment. Online payment is routed through the instif.id hub gateway — it's
 * offered whenever the shared hub secret is configured.
 */
billingRoutes.get("/methods", requireAuth, async (c) => {
  const manualMethods = await getActiveMethods();
  return c.json({
    manual: manualMethods.length > 0,
    manualMethods,
    gateway: hubService.isHubConfigured()
      ? { id: "hub", label: "instif.id" }
      : null,
  });
});

billingRoutes.post(
  "/order",
  requireAuth,
  validate("json", createOrderSchema),
  async (c) => {
    const { method, packs, refCode } = c.req.valid("json");
    const userId = c.get("user").sub;
    const normalizedRef = refCode?.replace(/^@/, "").trim() || undefined;
    if (method === "GATEWAY") {
      const result = await hubService.createHubCheckout(userId, packs, {
        callbackBaseUrl: env.PUBLIC_API_URL || new URL(c.req.url).origin,
        returnUrl: buildPaymentReturnUrl(),
        refCode: normalizedRef,
      });
      return c.json(result);
    }
    const result = await orderService.createCheckout(
      userId,
      "MANUAL",
      packs,
      normalizedRef
    );
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
  const userId = c.get("user").sub;
  const order = await orderService.attachProof(
    userId,
    c.req.param("id"),
    proofUrl
  );
  void notifyManualProofUploaded(order.id, userId);
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

/**
 * Paid notification from the instif.id hub for an online (hub-routed) order.
 * Signed with the shared SSO_SECRET; credits the buyer idempotently.
 */
billingRoutes.post("/hub-callback", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header(hubService.PARTNER_SIGNATURE_HEADER) ?? "";
  if (!hubService.verifyHubSignature(rawBody, signature)) {
    return c.json({ error: "Signature tidak valid" }, 401);
  }

  let body: { externalRef?: string; status?: string };
  try {
    body = JSON.parse(rawBody) as { externalRef?: string; status?: string };
  } catch {
    return c.json({ error: "Body tidak valid" }, 400);
  }

  if (body.status === "PAID" && body.externalRef) {
    await hubService.settleHubOrder(body.externalRef);
  }
  return c.json({ ok: true });
});
