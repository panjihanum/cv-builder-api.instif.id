import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { getCreditsPerPack } from "@/services/settings.service.js";

const INSUFFICIENT_MESSAGE = "Kredit tidak cukup, silakan beli paket";

export async function ensureCredit(userId: string): Promise<number> {
  const credit = await db.credit.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return credit.balance;
}

export async function getCreditBalance(userId: string): Promise<number> {
  const credit = await db.credit.findUnique({ where: { userId } });
  return credit?.balance ?? 0;
}

export async function assertCreditBalance(
  userId: string,
  cost: number
): Promise<void> {
  const balance = await getCreditBalance(userId);
  if (balance < cost) {
    throw new HttpError(402, INSUFFICIENT_MESSAGE);
  }
}

export async function consumeCredits(
  userId: string,
  cost: number
): Promise<number> {
  return db.$transaction(async (tx) => {
    const result = await tx.credit.updateMany({
      where: { userId, balance: { gte: cost } },
      data: { balance: { decrement: cost } },
    });
    if (result.count === 0) {
      throw new HttpError(402, INSUFFICIENT_MESSAGE);
    }
    const credit = await tx.credit.findUnique({ where: { userId } });
    return credit?.balance ?? 0;
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
  const creditsPerPack = await getCreditsPerPack();
  const creditAmount = order.packs * creditsPerPack;
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
      update: { balance: { increment: creditAmount } },
      create: { userId: order.userId, balance: creditAmount },
    });
  });
  return { alreadyPaid: false };
}
