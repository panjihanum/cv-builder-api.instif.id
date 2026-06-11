import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";

export const billingRoutes = new Hono<AuthEnv>();

billingRoutes.get("/credit", requireAuth, async (c) => {
  const credit = await creditService.getCredit(c.get("user").sub);
  return c.json(credit);
});
