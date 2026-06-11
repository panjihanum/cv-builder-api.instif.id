import { Hono } from "hono";
import { z } from "zod";
import { env } from "@/lib/env.js";
import { validate } from "@/lib/validation.js";
import { assertUploadedFile, saveUploadedFile } from "@/lib/uploads.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";
import * as orderService from "@/services/payment/order.service.js";
import * as duitkuService from "@/services/payment/duitku.service.js";

const createOrderSchema = z.object({
  method: z.enum(["DUITKU", "MANUAL"]),
  packs: z.number().int().min(1),
});

const duitkuCallbackSchema = z.object({
  merchantOrderId: z.string().min(1),
  amount: z.string().min(1),
  signature: z.string().min(1),
  resultCode: z.string().min(1),
});

const proofFileRule = {
  mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
  extensions: [".jpg", ".jpeg", ".png", ".pdf"],
  label: "jpg, png, atau pdf",
};

export const billingRoutes = new Hono<AuthEnv>();

billingRoutes.get("/credit", requireAuth, async (c) => {
  const credit = await creditService.getCredit(c.get("user").sub);
  return c.json(credit);
});

billingRoutes.get("/orders", requireAuth, async (c) => {
  const items = await orderService.listOrders(c.get("user").sub);
  return c.json({ items });
});

billingRoutes.post(
  "/order",
  requireAuth,
  validate("json", createOrderSchema),
  async (c) => {
    const { method, packs } = c.req.valid("json");
    const callbackUrl = `${new URL(c.req.url).origin}/billing/callback/duitku`;
    const returnUrl = env.CORS_ORIGIN.split(",")[0];
    const result = await orderService.createCheckout(
      c.get("user").sub,
      method,
      packs,
      { callbackUrl, returnUrl }
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
  const order = await orderService.attachProof(
    c.get("user").sub,
    c.req.param("id"),
    proofUrl
  );
  return c.json({ order });
});

billingRoutes.post(
  "/callback/duitku",
  validate("form", duitkuCallbackSchema),
  async (c) => {
    const result = await duitkuService.handleCallback(c.req.valid("form"));
    return c.json(result);
  }
);
