import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import { requireRole } from "@/middleware/requireRole.js";
import { adminSettingsRoutes } from "@/routes/admin/settings.js";

export const adminRoutes = new Hono<AuthEnv>();

adminRoutes.use("*", requireAuth, requireRole("ADMIN"));

adminRoutes.route("/settings", adminSettingsRoutes);
