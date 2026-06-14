/**
 * Payment-gateway abstraction. Each provider (Duitku, Xendit, …) implements this
 * interface so the rest of the app stays gateway-agnostic: the gateway service
 * picks the active provider from settings, and a single webhook endpoint
 * dispatches to `parseWebhook`.
 */

export interface PaymentChargeInput {
  /** Our order id; sent to the gateway as the merchant/external reference. */
  orderId: string;
  amount: number;
  packs: number;
  customerName: string;
  email: string;
  productDetails: string;
  /** Unified webhook URL the gateway should call back (per-provider path). */
  callbackUrl: string;
  /** Where to send the user after they finish paying. */
  returnUrl: string;
}

export interface PaymentChargeResult {
  /** Gateway-side reference/invoice id, stored on the order. */
  reference: string;
  /** Hosted payment page to redirect the user to. */
  paymentUrl: string;
}

export interface WebhookRequest {
  /** Raw request body text, for signature verification. */
  rawBody: string;
  /** Parsed body (JSON object or decoded form fields). */
  body: Record<string, unknown>;
  /** Request headers, keys lower-cased. */
  headers: Record<string, string>;
}

export type WebhookStatus = "PAID" | "PENDING" | "FAILED";

export interface WebhookOutcome {
  /** The order id this webhook refers to. */
  orderId: string;
  status: WebhookStatus;
}

export interface PaymentProvider {
  /** Stable id used in settings and the webhook path, e.g. "duitku". */
  readonly id: string;
  /** Human label shown in the dashboard/checkout, e.g. "Duitku". */
  readonly label: string;
  /** True when the admin has filled in this provider's credentials. */
  isConfigured(): Promise<boolean>;
  /** Create a hosted payment and return the URL to redirect the user to. */
  createCharge(input: PaymentChargeInput): Promise<PaymentChargeResult>;
  /** Verify and interpret an incoming webhook into a settle decision. */
  parseWebhook(request: WebhookRequest): Promise<WebhookOutcome>;
}
