import { z } from "zod";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { paginate, paginationArgs } from "@/lib/pagination.js";
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

export async function listPaymentsForAdmin(
  status?: string,
  page = 1,
  pageSize = 20
) {
  const where = status ? { status } : undefined;
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(page, pageSize),
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
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

export interface BulkPaymentResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

async function runBulk(
  ids: string[],
  handler: (id: string) => Promise<unknown>
): Promise<BulkPaymentResult> {
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  // Sequential on purpose: each order settles in its own transaction and we
  // want predictable, isolated failures rather than a single rolled-back batch.
  for (const id of ids) {
    try {
      await handler(id);
      succeeded.push(id);
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : "Gagal memproses",
      });
    }
  }
  return { succeeded, failed };
}

export function approvePayments(
  orderIds: string[]
): Promise<BulkPaymentResult> {
  return runBulk(orderIds, settleOrderPaid);
}

export function rejectPayments(orderIds: string[]): Promise<BulkPaymentResult> {
  return runBulk(orderIds, rejectPayment);
}
