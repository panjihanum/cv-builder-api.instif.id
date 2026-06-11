import { createMiddleware } from "hono/factory";
import type { AuthEnv } from "@/middleware/requireAuth.js";

export const requireRole = (role: string) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Autentikasi diperlukan" }, 401);
    }
    if (user.role !== role) {
      return c.json({ error: "Akses ditolak" }, 403);
    }
    await next();
  });
