import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import { requireRole } from "@/middleware/requireRole.js";
import { adminSettingsRoutes } from "@/routes/admin/settings.js";
import { adminPaymentsRoutes } from "@/routes/admin/payments.js";

export const adminRoutes = new Hono<AuthEnv>();

adminRoutes.use("*", requireAuth, requireRole("ADMIN"));

adminRoutes.route("/settings", adminSettingsRoutes);
adminRoutes.route("/payments", adminPaymentsRoutes);
