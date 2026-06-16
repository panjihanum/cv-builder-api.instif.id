import { Hono } from "hono";
import type { AuthEnv } from "@/middleware/requireAuth.js";
import * as adminUserService from "@/services/admin-user.service.js";

export const adminReferralsRoutes = new Hono<AuthEnv>();

adminReferralsRoutes.get("/", async (c) => {
  const items = await adminUserService.listReferrals();
  return c.json({ items });
});
