import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import { paginationQuerySchema } from "@/lib/pagination.js";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as manualService from "@/services/payment/manual.service.js";
import {
  pushUserApproved,
  pushUserRejected,
} from "@/services/paymentNotification.service.js";

const listPaymentsSchema = paginationQuerySchema.extend({
  status: z.string().optional(),
});

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export const adminPaymentsRoutes = new Hono<AuthEnv>();

adminPaymentsRoutes.get(
  "/",
  validate("query", listPaymentsSchema),
  async (c) => {
    const { status, page, pageSize } = c.req.valid("query");
    const result = await manualService.listPaymentsForAdmin(
      status,
      page,
      pageSize
    );
    return c.json(result);
  }
);

// Bulk routes registered before the `:id` routes so they are matched first.
adminPaymentsRoutes.post(
  "/bulk/approve",
  validate("json", bulkSchema),
  async (c) => {
    const { ids } = c.req.valid("json");
    const result = await manualService.approvePayments(ids);
    for (const id of result.succeeded) void pushUserApproved(id);
    return c.json(result);
  }
);

adminPaymentsRoutes.post(
  "/bulk/reject",
  validate("json", bulkSchema),
  async (c) => {
    const { ids } = c.req.valid("json");
    const result = await manualService.rejectPayments(ids);
    for (const id of result.succeeded) void pushUserRejected(id);
    return c.json(result);
  }
);

adminPaymentsRoutes.post("/:id/approve", async (c) => {
  const id = c.req.param("id");
  const order = await manualService.approvePayment(id);
  void pushUserApproved(id);
  return c.json({ order });
});

adminPaymentsRoutes.post("/:id/reject", async (c) => {
  const id = c.req.param("id");
  const order = await manualService.rejectPayment(id);
  void pushUserRejected(id);
  return c.json({ order });
});
