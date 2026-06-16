import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import {
  MANUAL_TYPES,
  getAllMethods,
  createMethod,
  updateMethod,
  deleteMethod,
  toggleMethod,
  reorderMethods,
} from "@/services/payment/manual.service.js";

const methodBodySchema = z.object({
  type: z.enum(MANUAL_TYPES),
  label: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  instructions: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
  qrImageUrl: z.string().optional(),
  phoneNumber: z.string().optional(),
  extraFields: z.record(z.string(), z.string()).optional(),
});

const updateBodySchema = methodBodySchema.partial();

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)),
});

export const adminPaymentMethodsRoutes = new Hono<AuthEnv>();

adminPaymentMethodsRoutes.get("/", async (c) => {
  const methods = await getAllMethods();
  return c.json({ methods });
});

adminPaymentMethodsRoutes.post(
  "/",
  validate("json", methodBodySchema),
  async (c) => {
    const method = await createMethod(c.req.valid("json"));
    return c.json({ method });
  }
);

adminPaymentMethodsRoutes.post(
  "/reorder",
  validate("json", reorderSchema),
  async (c) => {
    const methods = await reorderMethods(c.req.valid("json").ids);
    return c.json({ methods });
  }
);

adminPaymentMethodsRoutes.post("/:id/toggle", async (c) => {
  const method = await toggleMethod(c.req.param("id"));
  return c.json({ method });
});

adminPaymentMethodsRoutes.put(
  "/:id",
  validate("json", updateBodySchema),
  async (c) => {
    const method = await updateMethod(c.req.param("id"), c.req.valid("json"));
    return c.json({ method });
  }
);

adminPaymentMethodsRoutes.delete("/:id", async (c) => {
  await deleteMethod(c.req.param("id"));
  return c.json({ ok: true });
});
