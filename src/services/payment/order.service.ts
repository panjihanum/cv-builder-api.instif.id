import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { getPackPrice } from "@/services/settings.service.js";
import { getActiveMethods } from "@/services/payment/manual.service.js";

const orderSelect = {
  id: true,
  method: true,
  amount: true,
  packs: true,
  status: true,
  reference: true,
  proofUrl: true,
  paidAt: true,
  createdAt: true,
} as const;

export type OrderMethod = "MANUAL";

export async function listOrders(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: orderSelect,
  });
}

export async function getOwnedOrder(userId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    select: orderSelect,
  });
  if (!order) {
    throw new HttpError(404, "Order tidak ditemukan");
  }
  return order;
}

async function createOrder(userId: string, method: OrderMethod, packs: number) {
  const packPrice = await getPackPrice();
  return db.order.create({
    data: { userId, method, packs, amount: packs * packPrice },
    select: orderSelect,
  });
}

export async function createCheckout(
  userId: string,
  method: OrderMethod,
  packs: number
) {
  const order = await createOrder(userId, method, packs);
  const manualMethods = await getActiveMethods();
  return { order, manualMethods };
}

export async function attachProof(
  userId: string,
  orderId: string,
  proofUrl: string
) {
  const order = await getOwnedOrder(userId, orderId);
  if (order.status !== "PENDING") {
    throw new HttpError(400, "Order sudah diproses, bukti tidak bisa diubah");
  }
  return db.order.update({
    where: { id: orderId },
    data: { proofUrl },
    select: orderSelect,
  });
}
