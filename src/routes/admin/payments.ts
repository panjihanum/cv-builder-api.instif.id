import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as manualService from "@/services/payment/manual.service.js";

const listPaymentsSchema = z.object({
  status: z.string().optional(),
});

export const adminPaymentsRoutes = new Hono<AuthEnv>();

adminPaymentsRoutes.get(
  "/",
  validate("query", listPaymentsSchema),
  async (c) => {
    const { status } = c.req.valid("query");
    const items = await manualService.listPaymentsForAdmin(status);
    return c.json({ items });
  }
);

adminPaymentsRoutes.post("/:id/approve", async (c) => {
  const order = await manualService.approvePayment(c.req.param("id"));
  return c.json({ order });
});

adminPaymentsRoutes.post("/:id/reject", async (c) => {
  const order = await manualService.rejectPayment(c.req.param("id"));
  return c.json({ order });
});
