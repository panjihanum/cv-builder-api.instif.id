import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import { paginationQuerySchema } from "@/lib/pagination.js";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as adminUserService from "@/services/admin-user.service.js";

const listSchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});

const creditSchema = z.object({
  amount: z.coerce.number().int(),
  mode: z.enum(["add", "set"]).default("add"),
});

const updateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
  phone: z.string().min(8).nullable().optional(),
});

export const adminUsersRoutes = new Hono<AuthEnv>();

adminUsersRoutes.get("/", validate("query", listSchema), async (c) => {
  const { search, page, pageSize } = c.req.valid("query");
  const result = await adminUserService.listUsers(search, page, pageSize);
  return c.json(result);
});

adminUsersRoutes.post(
  "/:id/credit",
  validate("json", creditSchema),
  async (c) => {
    const { amount, mode } = c.req.valid("json");
    const result = await adminUserService.adjustCredit(
      c.req.param("id"),
      amount,
      mode
    );
    return c.json(result);
  }
);

adminUsersRoutes.patch("/:id", validate("json", updateSchema), async (c) => {
  const user = await adminUserService.updateUser(
    c.req.param("id"),
    c.req.valid("json")
  );
  return c.json({ user });
});
