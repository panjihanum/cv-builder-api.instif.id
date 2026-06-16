import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { env } from "@/lib/env.js";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { closeBrowser } from "@/services/pdf.service.js";
import { authRoutes } from "@/routes/auth.js";
import { cvRoutes } from "@/routes/cv.js";
import { adminRoutes } from "@/routes/admin/index.js";
import { billingRoutes } from "@/routes/billing.js";
import { aiRoutes } from "@/routes/ai.js";
import { exportRoutes } from "@/routes/export.js";
import { uploadRoutes } from "@/routes/upload.js";
import { otpRoutes } from "@/routes/otp.js";
import { templateRoutes } from "@/routes/templates.js";
import { quickRoutes } from "@/routes/quick.js";

const app = new Hono();

app.use("*", logger());

// Serve uploaded files (e.g. payment proofs) BEFORE secureHeaders(). Hono's
// secureHeaders() defaults to `Cross-Origin-Resource-Policy: same-origin`,
// which lets a direct browser navigation work but blocks the admin dashboard
// (a different origin) from embedding the file in <img>/<iframe>. serveStatic
// short-circuits without calling next() when the file exists, so registering
// it first means secureHeaders never overwrites our headers below.
app.use("/uploads/*", async (c, next) => {
  await next();
  // Allow cross-origin embedding (proof images/PDFs in the admin modal).
  c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  // Uploads are user-controlled, so keep MIME sniffing disabled.
  c.res.headers.set("X-Content-Type-Options", "nosniff");
});
app.use("/uploads/*", serveStatic({ root: "./" }));

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

app.route("/auth", authRoutes);
app.route("/cv", cvRoutes);
app.route("/ai", aiRoutes);
app.route("/export", exportRoutes);
app.route("/upload", uploadRoutes);
app.route("/billing", billingRoutes);
app.route("/otp", otpRoutes);
app.route("/templates", templateRoutes);
app.route("/admin", adminRoutes);
app.route("/quick", quickRoutes);

app.notFound((c) => c.json({ error: "Route tidak ditemukan" }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Terjadi kesalahan pada server" }, 500);
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`CV Builder API berjalan di http://localhost:${info.port}`);
});

function shutdown(): void {
  server.close();
  void Promise.allSettled([closeBrowser(), db.$disconnect()]).then(() =>
    process.exit(0)
  );
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
