import crypto from "node:crypto";
import { db } from "@/lib/db.js";
import { env } from "@/lib/env.js";
import { HttpError } from "@/lib/httpError.js";
import { getPackPrice } from "@/services/settings.service.js";
import { settleOrderPaid } from "@/services/credit.service.js";
import { notifyGatewayPaid } from "@/services/paymentNotification.service.js";

/**
 * Online payments are routed through the instif.id hub instead of cv-builder
 * holding its own Duitku/Xendit credentials. We create the local order, ask the
 * hub to create the invoice (signed with the shared SSO_SECRET), and the hub
 * notifies `/billing/hub-callback` once the buyer pays so we credit them.
 */

const APP_ID = "cv-builder";
export const PARTNER_SIGNATURE_HEADER = "x-partner-signature";

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

/** Online payment is available when the shared hub secret is configured. */
export function isHubConfigured(): boolean {
  return Boolean(env.SSO_SECRET && env.SSO_SECRET.length > 0);
}

function sign(rawBody: string): string {
  return crypto
    .createHmac("sha256", env.SSO_SECRET ?? "")
    .update(rawBody)
    .digest("hex");
}

/** Constant-time verification of an incoming hub callback signature. */
export function verifyHubSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!isHubConfigured() || !signature) return false;
  const expected = sign(rawBody);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export interface HubCheckoutContext {
  /** This API's public origin — where the hub POSTs the paid notification. */
  callbackBaseUrl: string;
  /** App URL to return the buyer to after paying. */
  returnUrl: string;
  refCode?: string;
}

/**
 * Create a credit-pack order and obtain a hosted payment URL from the hub.
 */
export async function createHubCheckout(
  userId: string,
  packs: number,
  context: HubCheckoutContext
) {
  if (!isHubConfigured()) {
    throw new HttpError(503, "Pembayaran otomatis belum diaktifkan admin");
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
      method: "HUB",
      packs,
      amount,
      refCode: context.refCode ?? null,
    },
    select: orderSelect,
  });

  const payload = JSON.stringify({
    app: APP_ID,
    externalRef: order.id,
    amount,
    productName: `${packs} paket kredit`,
    customerName: user?.name ?? "Pelanggan",
    email: user?.email ?? "",
    returnUrl: context.returnUrl,
    callbackUrl: `${context.callbackBaseUrl}/billing/hub-callback`,
  });

  let paymentUrl: string;
  let reference: string;
  try {
    const res = await fetch(`${env.INSTIF_HUB_URL}/api/partner/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [PARTNER_SIGNATURE_HEADER]: sign(payload),
      },
      body: payload,
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { paymentUrl?: string; reference?: string };
      error?: string;
    };
    if (!res.ok || !json.data?.paymentUrl) {
      throw new HttpError(
        502,
        json.error ?? "Gagal membuat pembayaran di gateway instif.id"
      );
    }
    paymentUrl = json.data.paymentUrl;
    reference = json.data.reference ?? "";
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, "Tidak dapat terhubung ke gateway instif.id");
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: { reference },
    select: orderSelect,
  });

  return { order: updated, paymentUrl };
}

/**
 * Credit the buyer after the hub reports their order paid. Idempotent via
 * settleOrderPaid (a re-delivered callback won't double-credit).
 */
export async function settleHubOrder(orderId: string): Promise<void> {
  await settleOrderPaid(orderId);
  void notifyGatewayPaid(orderId);
}
