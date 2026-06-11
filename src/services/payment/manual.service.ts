import { z } from "zod";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { getSetting } from "@/services/settings.service.js";
import { settleOrderPaid } from "@/services/credit.service.js";

const bankAccountSchema = z.object({
  bankName: z.string(),
  accountNumber: z.string(),
  accountHolder: z.string(),
});

export type BankAccount = z.infer<typeof bankAccountSchema>;

export async function getBankAccounts(): Promise<BankAccount[]> {
  const raw = (await getSetting("bank.accounts")) ?? "[]";
  try {
    return z.array(bankAccountSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function listPaymentsForAdmin(status?: string) {
  return db.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function approvePayment(orderId: string) {
  await settleOrderPaid(orderId);
  return db.order.findUnique({ where: { id: orderId } });
}

export async function rejectPayment(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new HttpError(404, "Order tidak ditemukan");
  }
  if (order.status === "PAID") {
    throw new HttpError(400, "Order sudah dibayar, tidak bisa ditolak");
  }
  return db.order.update({
    where: { id: orderId },
    data: { status: "REJECTED" },
  });
}
