import { normalizePhone } from "@/lib/phone.js";
import * as waGateway from "@/lib/waGateway.js";

export async function requestOtp(
  phone: string,
  purpose: string
): Promise<{ ok: true }> {
  const target = purpose === "LOGIN" ? "LOGIN" : "VERIFY_PHONE";
  await waGateway.requestOtp(normalizePhone(phone), target);
  return { ok: true };
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ ok: true }> {
  await waGateway.verifyOtp(normalizePhone(phone), code);
  return { ok: true };
}
