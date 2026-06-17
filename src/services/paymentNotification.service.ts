import { db } from "@/lib/db.js";
import { env } from "@/lib/env.js";
import * as wa from "@/lib/waGateway.js";
import { generateToken } from "@/lib/quickToken.js";
import { getSetting, getCreditsPerPack } from "@/services/settings.service.js";

const METHOD_LABELS: Record<string, string> = {
  MANUAL: "Transfer Manual",
  GATEWAY: "Pembayaran Otomatis",
};

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

function formatCredits(packs: number, creditsPerPack: number): string {
  return `${packs} pack (${packs * creditsPerPack} kredit)`;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Nomor admin dari DB setting, fallback ke env bila belum diatur. */
async function getAdminPhone(): Promise<string | null> {
  const fromDb = await getSetting("notification.phone");
  if (fromDb?.trim()) return fromDb.trim();
  return env.NOTIFICATION_PHONE?.trim() ?? null;
}

function buildQuickUrls(orderId: string): {
  approveUrl: string;
  rejectUrl: string;
} {
  const base = env.PUBLIC_API_URL ?? "";
  return {
    approveUrl: `${base}/quick/pay/${orderId}/approve?token=${generateToken("approve", orderId)}`,
    rejectUrl: `${base}/quick/pay/${orderId}/reject?token=${generateToken("reject", orderId)}`,
  };
}

/**
 * Kirim notif ke admin WA saat user upload bukti transfer manual.
 * Include gambar bukti + link approve/reject langsung dari WA.
 */
export async function notifyManualProofUploaded(
  orderId: string,
  userId: string
): Promise<void> {
  const adminPhone = await getAdminPhone();
  if (!adminPhone) return;

  try {
    const [order, user, creditsPerPack] = await Promise.all([
      db.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          amount: true,
          packs: true,
          method: true,
          proofUrl: true,
          createdAt: true,
        },
      }),
      db.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, phone: true },
      }),
      getCreditsPerPack(),
    ]);
    if (!order || !user) return;

    const { approveUrl, rejectUrl } = buildQuickUrls(orderId);
    const apiBase = env.PUBLIC_API_URL ?? "";
    const proofFullUrl = order.proofUrl ? `${apiBase}${order.proofUrl}` : null;

    const lines = [
      `💳 *Pembayaran Masuk* — CV Builder`,
      ``,
      `*ID:* \`${order.id}\``,
      `*Nama:* ${user.name}`,
      `*No. HP:* ${user.phone ?? "-"}`,
      `*Email:* ${user.email ?? "-"}`,
      `*Metode:* ${methodLabel(order.method)}`,
      `*Paket:* ${formatCredits(order.packs, creditsPerPack)}`,
      `*Jumlah:* ${formatRupiah(order.amount)}`,
      proofFullUrl ? `*Bukti:* ${proofFullUrl}` : `⚠️ Belum ada bukti transfer`,
      ``,
      `✅ *SETUJUI:*\n${approveUrl}`,
      ``,
      `❌ *TOLAK:*\n${rejectUrl}`,
    ];

    await wa.sendMessage(adminPhone, lines.join("\n"));

    if (proofFullUrl) {
      await wa.sendFile(
        adminPhone,
        proofFullUrl,
        `Bukti pembayaran — ${user.name} (${order.id})`
      );
    }
  } catch (err) {
    console.error("[PaymentNotif] Gagal kirim notifikasi manual:", err);
  }
}

/**
 * Kirim notif ke admin WA saat gateway webhook otomatis settle pembayaran.
 */
export async function notifyGatewayPaid(orderId: string): Promise<void> {
  const adminPhone = await getAdminPhone();
  if (!adminPhone) return;

  try {
    const [order, creditsPerPack] = await Promise.all([
      db.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { name: true, email: true, phone: true } },
        },
      }),
      getCreditsPerPack(),
    ]);
    if (!order?.user) return;

    const lines = [
      `✅ *Pembayaran Gateway Diterima* — CV Builder`,
      ``,
      `*ID:* \`${order.id}\``,
      `*Nama:* ${order.user.name}`,
      `*No. HP:* ${order.user.phone ?? "-"}`,
      `*Email:* ${order.user.email ?? "-"}`,
      `*Metode:* ${methodLabel(order.method)}`,
      `*Paket:* ${formatCredits(order.packs, creditsPerPack)}`,
      `*Jumlah:* ${formatRupiah(order.amount)}`,
      `*Status:* Otomatis disetujui ✓`,
    ];

    await wa.sendMessage(adminPhone, lines.join("\n"));
  } catch (err) {
    console.error("[PaymentNotif] Gagal kirim notifikasi gateway:", err);
  }
}

/**
 * Push WA ke USER saat pembayarannya disetujui admin.
 * Hanya dikirim jika user punya nomor HP tersimpan.
 */
export async function pushUserApproved(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, phone: true } },
      },
    });
    if (!order?.user?.phone) return;

    const lines = [
      `✅ *Pembayaran Disetujui* — CV Builder`,
      ``,
      `Halo ${order.user.name},`,
      ``,
      `Pembayaran Anda telah *disetujui*!`,
      `*${order.packs} pack kredit* sudah ditambahkan ke akun Anda.`,
      ``,
      `Terima kasih sudah berlangganan CV Builder 🎉`,
    ];

    await wa.sendMessage(order.user.phone, lines.join("\n"));
  } catch (err) {
    console.error("[PaymentNotif] Gagal push notif approved ke user:", err);
  }
}

/**
 * Push WA ke USER saat pembayarannya ditolak admin.
 */
export async function pushUserRejected(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, phone: true } },
      },
    });
    if (!order?.user?.phone) return;

    const lines = [
      `❌ *Pembayaran Ditolak* — CV Builder`,
      ``,
      `Halo ${order.user.name},`,
      ``,
      `Maaf, pembayaran Anda *tidak dapat dikonfirmasi*.`,
      `Silakan lakukan order ulang dan pastikan bukti transfer sesuai.`,
      ``,
      `Butuh bantuan? Hubungi admin kami.`,
    ];

    await wa.sendMessage(order.user.phone, lines.join("\n"));
  } catch (err) {
    console.error("[PaymentNotif] Gagal push notif rejected ke user:", err);
  }
}
