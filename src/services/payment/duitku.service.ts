import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/httpError.js";
import { getRequiredSetting, getSetting } from "@/services/settings.service.js";
import { settleOrderPaid } from "@/services/credit.service.js";

const SANDBOX_BASE_URL = "https://sandbox.duitku.com/webapi/api/merchant";
const PRODUCTION_BASE_URL = "https://passport.duitku.com/webapi/api/merchant";
const CONFIG_MISSING_MESSAGE =
  "Duitku belum dikonfigurasi, isi duitku.merchantCode dan duitku.apiKey di halaman admin settings";

export interface DuitkuConfig {
  merchantCode: string;
  apiKey: string;
  baseUrl: string;
}

export async function getDuitkuConfig(): Promise<DuitkuConfig> {
  const merchantCode = await getRequiredSetting(
    "duitku.merchantCode",
    CONFIG_MISSING_MESSAGE
  );
  const apiKey = await getRequiredSetting(
    "duitku.apiKey",
    CONFIG_MISSING_MESSAGE
  );
  const environment = (await getSetting("duitku.env")) ?? "sandbox";
  const baseUrl =
    environment === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
  return { merchantCode, apiKey, baseUrl };
}

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export function createInvoiceSignature(
  config: Pick<DuitkuConfig, "merchantCode" | "apiKey">,
  merchantOrderId: string,
  amount: number
): string {
  return md5(
    `${config.merchantCode}${merchantOrderId}${amount}${config.apiKey}`
  );
}

export function verifyCallbackSignature(
  config: Pick<DuitkuConfig, "merchantCode" | "apiKey">,
  params: { amount: string; merchantOrderId: string; signature: string }
): boolean {
  const expected = md5(
    `${config.merchantCode}${params.amount}${params.merchantOrderId}${config.apiKey}`
  );
  const expectedBuffer = Buffer.from(expected);
  const givenBuffer = Buffer.from(params.signature);
  if (expectedBuffer.length !== givenBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, givenBuffer);
}

export interface CreateInvoiceInput {
  merchantOrderId: string;
  amount: number;
  productDetails: string;
  customerName: string;
  email: string;
  callbackUrl: string;
  returnUrl: string;
}

export interface CreateInvoiceResult {
  reference: string;
  paymentUrl: string;
}

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<CreateInvoiceResult> {
  const config = await getDuitkuConfig();
  const signature = createInvoiceSignature(
    config,
    input.merchantOrderId,
    input.amount
  );
  const body = {
    merchantCode: config.merchantCode,
    paymentAmount: input.amount,
    merchantOrderId: input.merchantOrderId,
    productDetails: input.productDetails,
    customerVaName: input.customerName.slice(0, 20),
    email: input.email,
    customerDetail: {
      firstName: input.customerName,
      email: input.email,
    },
    callbackUrl: input.callbackUrl,
    returnUrl: input.returnUrl,
    signature,
    expiryPeriod: 60,
  };
  const response = await fetch(`${config.baseUrl}/v2/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new HttpError(
      502,
      `Duitku inquiry gagal dengan status ${response.status}`
    );
  }
  const data = (await response.json()) as {
    statusCode: string;
    statusMessage: string;
    reference: string;
    paymentUrl: string;
  };
  if (data.statusCode !== "00") {
    throw new HttpError(502, `Duitku menolak request: ${data.statusMessage}`);
  }
  return { reference: data.reference, paymentUrl: data.paymentUrl };
}

export interface DuitkuCallbackInput {
  merchantOrderId: string;
  amount: string;
  signature: string;
  resultCode: string;
}

export async function handleCallback(
  input: DuitkuCallbackInput
): Promise<{ ok: true }> {
  const config = await getDuitkuConfig();
  if (!verifyCallbackSignature(config, input)) {
    throw new HttpError(400, "Signature callback tidak valid");
  }
  if (input.resultCode !== "00") {
    return { ok: true };
  }
  await settleOrderPaid(input.merchantOrderId);
  return { ok: true };
}
