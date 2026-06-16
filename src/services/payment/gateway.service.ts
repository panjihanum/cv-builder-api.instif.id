import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { getPackPrice, getSetting } from "@/services/settings.service.js";
import { settleOrderPaid } from "@/services/credit.service.js";
import { notifyGatewayPaid } from "@/services/paymentNotification.service.js";
import {
  getPaymentProvider,
  paymentProviders,
} from "@/services/payment/providers/index.js";
import type { WebhookRequest } from "@/services/payment/providers/types.js";

const orderSelect = {
  id: true,
  method: true,
  amount: true,
  packs: true,
  status: true,
  reference: true,
  refCode: true,
  proofUrl: true,
  paidAt: true,
  createdAt: true,
} as const;

/** The provider id the admin selected as active, or null when none/unknown. */
export async function getActiveProviderId(): Promise<string | null> {
  const id = (await getSetting("payment.provider")) ?? "";
  return id && paymentProviders[id] ? id : null;
}

export interface ActiveProvider {
  id: string;
  label: string;
  configured: boolean;
}

/** Active provider info for the dashboard/checkout, or null when none. */
export async function getActiveProvider(): Promise<ActiveProvider | null> {
  const id = await getActiveProviderId();
  if (!id) return null;
  const provider = paymentProviders[id];
  return {
    id: provider.id,
    label: provider.label,
    configured: await provider.isConfigured(),
  };
}

export interface GatewayCheckoutContext {
  /** API origin the gateway should call back to, e.g. https://api.example.com */
  callbackBaseUrl: string;
  /** App URL to return the user to after paying. */
  returnUrl: string;
  /** Optional referral code to attach to the order. */
  refCode?: string;
}

/**
 * Create an order for the active automatic gateway, ask it for a hosted payment
 * page, and return the URL to redirect the user to.
 */
export async function createGatewayCheckout(
  userId: string,
  packs: number,
  context: GatewayCheckoutContext
) {
  const providerId = await getActiveProviderId();
  if (!providerId) {
    throw new HttpError(503, "Pembayaran otomatis belum diaktifkan admin");
  }
  const provider = getPaymentProvider(providerId);
  if (!(await provider.isConfigured())) {
    throw new HttpError(503, `${provider.label} belum dikonfigurasi admin`);
  }

  const packPrice = await getPackPrice();
  const amount = packs * packPrice;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const order = await db.order.create({
    data: {
      userId,
      method: provider.id.toUpperCase(),
      packs,
      amount,
      refCode: context.refCode ?? null,
    },
    select: orderSelect,
  });

  const charge = await provider.createCharge({
    orderId: order.id,
    amount,
    packs,
    customerName: user?.name ?? "Pelanggan",
    email: user?.email ?? "",
    productDetails: `${packs} paket kredit`,
    callbackUrl: `${context.callbackBaseUrl}/billing/webhook/${provider.id}`,
    returnUrl: context.returnUrl,
  });

  const updated = await db.order.update({
    where: { id: order.id },
    data: { reference: charge.reference },
    select: orderSelect,
  });

  return { order: updated, paymentUrl: charge.paymentUrl };
}

/**
 * Single entry point for every gateway webhook. The provider verifies the
 * signature/token and reports the outcome; we settle the order when paid.
 */
export async function handleWebhook(
  providerId: string,
  request: WebhookRequest
) {
  const provider = getPaymentProvider(providerId);
  const outcome = await provider.parseWebhook(request);
  if (outcome.status === "PAID") {
    await settleOrderPaid(outcome.orderId);
    void notifyGatewayPaid(outcome.orderId);
  }
  return {
    ok: true as const,
    status: outcome.status,
    orderId: outcome.orderId,
  };
}
