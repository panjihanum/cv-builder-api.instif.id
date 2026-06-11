import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { EXPORT_PER_PACK } from "@/config/pricing.js";
import { getAiPerPack } from "@/services/settings.service.js";

export interface CreditBalance {
  exportLeft: number;
  aiUploadsLeft: number;
}

export async function getCredit(userId: string): Promise<CreditBalance> {
  const credit = await db.credit.findUnique({ where: { userId } });
  return {
    exportLeft: credit?.exportLeft ?? 0,
    aiUploadsLeft: credit?.aiUploadsLeft ?? 0,
  };
}

export async function consumeExportCredit(userId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const result = await tx.credit.updateMany({
      where: { userId, exportLeft: { gt: 0 } },
      data: { exportLeft: { decrement: 1 } },
    });
    if (result.count === 0) {
      throw new HttpError(402, "Kredit export habis, silakan beli paket");
    }
    const credit = await tx.credit.findUnique({ where: { userId } });
    return credit?.exportLeft ?? 0;
  });
}

export async function consumeAiUploadCredit(userId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const result = await tx.credit.updateMany({
      where: { userId, aiUploadsLeft: { gt: 0 } },
      data: { aiUploadsLeft: { decrement: 1 } },
    });
    if (result.count === 0) {
      throw new HttpError(402, "Kuota upload AI habis, silakan beli paket");
    }
    const credit = await tx.credit.findUnique({ where: { userId } });
    return credit?.aiUploadsLeft ?? 0;
  });
}

export async function topUpCredits(
  userId: string,
  packs: number
): Promise<void> {
  const aiPerPack = await getAiPerPack();
  const exportAmount = packs * EXPORT_PER_PACK;
  const aiAmount = packs * aiPerPack;
  await db.$transaction(async (tx) => {
    await tx.credit.upsert({
      where: { userId },
      update: {
        exportLeft: { increment: exportAmount },
        aiUploadsLeft: { increment: aiAmount },
      },
      create: {
        userId,
        exportLeft: exportAmount,
        aiUploadsLeft: aiAmount,
      },
    });
  });
}

export async function settleOrderPaid(
  orderId: string
): Promise<{ alreadyPaid: boolean }> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new HttpError(404, "Order tidak ditemukan");
  }
  if (order.status === "PAID") {
    return { alreadyPaid: true };
  }
  const aiPerPack = await getAiPerPack();
  const exportAmount = order.packs * EXPORT_PER_PACK;
  const aiAmount = order.packs * aiPerPack;
  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (updated.count === 0) {
      return;
    }
    await tx.credit.upsert({
      where: { userId: order.userId },
      update: {
        exportLeft: { increment: exportAmount },
        aiUploadsLeft: { increment: aiAmount },
      },
      create: {
        userId: order.userId,
        exportLeft: exportAmount,
        aiUploadsLeft: aiAmount,
      },
    });
  });
  return { alreadyPaid: false };
}
