import { Hono } from "hono";
import { verifyToken } from "@/lib/quickToken.js";
import {
  approvePayment,
  rejectPayment,
} from "@/services/payment/manual.service.js";
import {
  pushUserApproved,
  pushUserRejected,
} from "@/services/paymentNotification.service.js";

export const quickRoutes = new Hono();

function page(
  icon: string,
  title: string,
  body: string,
  color: string
): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#f4f4f5}
    .card{background:#fff;border-radius:1rem;padding:2.5rem 2rem;max-width:420px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .icon{font-size:3.5rem;margin-bottom:1rem}
    h1{color:${color};font-size:1.4rem;margin-bottom:.5rem}
    p{color:#71717a;font-size:.95rem;line-height:1.5}
    .brand{margin-top:2rem;font-size:.75rem;color:#a1a1aa}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <p class="brand">CV Builder · instif.id</p>
  </div>
</body>
</html>`;
}

quickRoutes.get("/pay/:id/approve", async (c) => {
  const orderId = c.req.param("id");
  const token = c.req.query("token") ?? "";

  if (!verifyToken("approve", orderId, token)) {
    return c.html(
      page(
        "🚫",
        "Token Tidak Valid",
        "Link tidak valid atau sudah diubah.",
        "#ef4444"
      ),
      403
    );
  }

  try {
    await approvePayment(orderId);
    void pushUserApproved(orderId);
    return c.html(
      page(
        "✅",
        "Pembayaran Disetujui",
        `Order <strong>${orderId}</strong> berhasil disetujui.<br>Kredit sudah ditambahkan ke akun user.`,
        "#22c55e"
      )
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
    return c.html(page("⚠️", "Gagal", msg, "#f59e0b"), 400);
  }
});

quickRoutes.get("/pay/:id/reject", async (c) => {
  const orderId = c.req.param("id");
  const token = c.req.query("token") ?? "";

  if (!verifyToken("reject", orderId, token)) {
    return c.html(
      page(
        "🚫",
        "Token Tidak Valid",
        "Link tidak valid atau sudah diubah.",
        "#ef4444"
      ),
      403
    );
  }

  try {
    await rejectPayment(orderId);
    void pushUserRejected(orderId);
    return c.html(
      page(
        "❌",
        "Pembayaran Ditolak",
        `Order <strong>${orderId}</strong> telah ditolak.<br>User perlu melakukan order ulang.`,
        "#ef4444"
      )
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
    return c.html(page("⚠️", "Gagal", msg, "#f59e0b"), 400);
  }
});
