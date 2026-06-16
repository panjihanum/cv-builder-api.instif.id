import { createMiddleware } from "hono/factory";

export const requireApiKey = createMiddleware(async (c, next) => {
  const key = process.env.ADMIN_STATS_KEY;
  if (!key) {
    return c.json({ error: "Stats endpoint tidak dikonfigurasi" }, 503);
  }
  const provided = c.req.header("X-Api-Key");
  if (!provided || provided !== key) {
    return c.json({ error: "API key tidak valid" }, 401);
  }
  await next();
});
