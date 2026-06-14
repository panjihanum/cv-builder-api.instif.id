import { HttpError } from "@/lib/httpError.js";
import { getSetting } from "@/services/settings.service.js";
import {
  createInvoice,
  getDuitkuConfig,
  verifyCallbackSignature,
} from "@/services/payment/duitku.service.js";
import type {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentProvider,
  WebhookOutcome,
  WebhookRequest,
} from "@/services/payment/providers/types.js";

/**
 * Duitku provider — wraps the existing duitku.service inquiry/callback logic
 * (MD5 signatures) behind the generic PaymentProvider interface.
 */
export const duitkuProvider: PaymentProvider = {
  id: "duitku",
  label: "Duitku",

  async isConfigured(): Promise<boolean> {
    const merchantCode = await getSetting("duitku.merchantCode");
    const apiKey = await getSetting("duitku.apiKey");
    return Boolean(merchantCode && apiKey);
  },

  async createCharge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    return createInvoice({
      merchantOrderId: input.orderId,
      amount: input.amount,
      productDetails: input.productDetails,
      customerName: input.customerName,
      email: input.email,
      callbackUrl: input.callbackUrl,
      returnUrl: input.returnUrl,
    });
  },

  async parseWebhook(request: WebhookRequest): Promise<WebhookOutcome> {
    const body = request.body as Record<string, unknown>;
    const merchantOrderId = String(body.merchantOrderId ?? "");
    const amount = String(body.amount ?? "");
    const signature = String(body.signature ?? "");
    const resultCode = String(body.resultCode ?? "");
    if (!merchantOrderId) {
      throw new HttpError(400, "Callback Duitku tanpa merchantOrderId");
    }
    const config = await getDuitkuConfig();
    if (
      !verifyCallbackSignature(config, { amount, merchantOrderId, signature })
    ) {
      throw new HttpError(400, "Signature callback Duitku tidak valid");
    }
    return {
      orderId: merchantOrderId,
      status: resultCode === "00" ? "PAID" : "FAILED",
    };
  },
};
