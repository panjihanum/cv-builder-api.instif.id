import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { env } from "@/lib/env.js";
import { HttpError } from "@/lib/httpError.js";
import { authRoutes } from "@/routes/auth.js";
import { cvRoutes } from "@/routes/cv.js";
import { adminRoutes } from "@/routes/admin/index.js";
import { billingRoutes } from "@/routes/billing.js";
import { aiRoutes } from "@/routes/ai.js";
import { exportRoutes } from "@/routes/export.js";

const app = new Hono();

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN.split(","),
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.get("/", (c) =>
  c.json({
    name: "CV Builder API",
    status: "ok",
    timestamp: new Date().toISOString(),
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.use("/uploads/*", serveStatic({ root: "./" }));

app.route("/auth", authRoutes);
app.route("/cv", cvRoutes);
app.route("/ai", aiRoutes);
app.route("/export", exportRoutes);
app.route("/billing", billingRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.json({ error: "Route tidak ditemukan" }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Terjadi kesalahan pada server" }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`CV Builder API berjalan di http://localhost:${info.port}`);
});

export default app;
