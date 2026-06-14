import { timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/httpError.js";
import { getRequiredSetting, getSetting } from "@/services/settings.service.js";
import type {
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentProvider,
  WebhookOutcome,
  WebhookRequest,
} from "@/services/payment/providers/types.js";

const INVOICE_URL = "https://api.xendit.co/v2/invoices";
const CONFIG_MISSING_MESSAGE =
  "Xendit belum dikonfigurasi, isi xendit.apiKey dan xendit.callbackToken di halaman admin settings";

export interface XenditConfig {
  apiKey: string;
  callbackToken: string;
}

export async function getXenditConfig(): Promise<XenditConfig> {
  const apiKey = await getRequiredSetting(
    "xendit.apiKey",
    CONFIG_MISSING_MESSAGE
  );
  const callbackToken = await getRequiredSetting(
    "xendit.callbackToken",
    CONFIG_MISSING_MESSAGE
  );
  return { apiKey, callbackToken };
}

/** Constant-time compare of the x-callback-token header against the secret. */
export function verifyCallbackToken(
  expected: string,
  provided: string
): boolean {
  const expectedBuffer = Buffer.from(expected);
  const givenBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== givenBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, givenBuffer);
}

/** Map Xendit invoice statuses onto our settle decision. */
export function mapInvoiceStatus(status: string): WebhookOutcome["status"] {
  const normalized = status.toUpperCase();
  if (normalized === "PAID" || normalized === "SETTLED") return "PAID";
  if (normalized === "EXPIRED" || normalized === "FAILED") return "FAILED";
  return "PENDING";
}

export const xenditProvider: PaymentProvider = {
  id: "xendit",
  label: "Xendit",

  async isConfigured(): Promise<boolean> {
    const apiKey = await getSetting("xendit.apiKey");
    const callbackToken = await getSetting("xendit.callbackToken");
    return Boolean(apiKey && callbackToken);
  },

  async createCharge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    const { apiKey } = await getXenditConfig();
    const auth = Buffer.from(`${apiKey}:`).toString("base64");
    const response = await fetch(INVOICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        external_id: input.orderId,
        amount: input.amount,
        description: input.productDetails,
        payer_email: input.email || undefined,
        success_redirect_url: input.returnUrl,
        failure_redirect_url: input.returnUrl,
        customer: {
          given_names: input.customerName,
          email: input.email || undefined,
        },
        invoice_duration: 3600,
      }),
    });
    if (!response.ok) {
      throw new HttpError(
        502,
        `Xendit invoice gagal dengan status ${response.status}`
      );
    }
    const data = (await response.json()) as {
      id?: string;
      invoice_url?: string;
    };
    if (!data.invoice_url || !data.id) {
      throw new HttpError(502, "Xendit tidak mengembalikan invoice_url");
    }
    return { reference: data.id, paymentUrl: data.invoice_url };
  },

  async parseWebhook(request: WebhookRequest): Promise<WebhookOutcome> {
    const { callbackToken } = await getXenditConfig();
    const provided = request.headers["x-callback-token"] ?? "";
    if (!verifyCallbackToken(callbackToken, provided)) {
      throw new HttpError(401, "Token callback Xendit tidak valid");
    }
    const body = request.body as Record<string, unknown>;
    const orderId = String(body.external_id ?? "");
    if (!orderId) {
      throw new HttpError(400, "Callback Xendit tanpa external_id");
    }
    return { orderId, status: mapInvoiceStatus(String(body.status ?? "")) };
  },
};
