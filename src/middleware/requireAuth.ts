import { createMiddleware } from "hono/factory";
import { verifyToken, type JwtPayload } from "@/lib/jwt.js";

export interface AuthEnv {
  Variables: {
    user: JwtPayload;
  };
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Autentikasi diperlukan" }, 401);
  }
  try {
    const payload = await verifyToken(header.slice("Bearer ".length));
    c.set("user", payload);
  } catch {
    return c.json({ error: "Token tidak valid" }, 401);
  }
  await next();
});
