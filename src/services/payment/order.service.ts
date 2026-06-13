import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { getPackPrice } from "@/services/settings.service.js";
import {
  createInvoice,
  getDuitkuConfig,
} from "@/services/payment/duitku.service.js";
import { getBankAccounts } from "@/services/payment/manual.service.js";

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

export type OrderMethod = "DUITKU" | "MANUAL";

export interface CheckoutUrls {
  callbackUrl: string;
  returnUrl: string;
}

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
  packs: number,
  urls: CheckoutUrls
) {
  if (method === "MANUAL") {
    const order = await createOrder(userId, method, packs);
    const bankAccounts = await getBankAccounts();
    return { order, bankAccounts };
  }
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User tidak ditemukan");
  }
  await getDuitkuConfig();
  const order = await createOrder(userId, method, packs);
  const invoice = await createInvoice({
    merchantOrderId: order.id,
    amount: order.amount,
    productDetails: `${packs} paket kredit CV Builder`,
    customerName: user.name,
    email: user.email ?? `${user.phone ?? user.id}@noemail.instif.id`,
    callbackUrl: urls.callbackUrl,
    returnUrl: urls.returnUrl,
  });
  const updated = await db.order.update({
    where: { id: order.id },
    data: { reference: invoice.reference },
    select: orderSelect,
  });
  return { order: updated, paymentUrl: invoice.paymentUrl };
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
