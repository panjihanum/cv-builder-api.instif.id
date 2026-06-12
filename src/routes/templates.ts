import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as templateService from "@/services/template.service.js";

export const templateRoutes = new Hono<AuthEnv>();

// Public: aggregate usage + wishlist counts for sorting the showcase.
templateRoutes.get("/stats", async (c) => {
  const items = await templateService.getTemplateStats();
  return c.json({ items });
});

// The current user's wishlisted template ids.
templateRoutes.get("/wishlist", requireAuth, async (c) => {
  const items = await templateService.listWishlist(c.get("user").sub);
  return c.json({ items });
});

templateRoutes.put("/wishlist/:id", requireAuth, async (c) => {
  await templateService.addToWishlist(c.get("user").sub, c.req.param("id"));
  return c.json({ ok: true });
});

templateRoutes.delete("/wishlist/:id", requireAuth, async (c) => {
  await templateService.removeFromWishlist(
    c.get("user").sub,
    c.req.param("id")
  );
  return c.json({ ok: true });
});
