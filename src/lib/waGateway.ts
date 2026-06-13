import { env } from "@/lib/env.js";
import { HttpError } from "@/lib/httpError.js";

const BASE = env.WA_GATEWAY_URL;
const SECRET = env.WA_GATEWAY_SECRET;

async function call(
  path: string,
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new HttpError(503, "Gateway WhatsApp tidak merespons");
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return { ok: res.ok && data.ok !== false, error: data.error };
}

export async function requestOtp(
  phone: string,
  purpose: "LOGIN" | "VERIFY_PHONE"
): Promise<void> {
  const result = await call("/otp/request", {
    phone,
    purpose,
    appId: "cv-builder",
  });
  if (!result.ok) {
    throw new HttpError(503, result.error ?? "Gagal mengirim OTP");
  }
}

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const result = await call("/otp/verify", { phone, code });
  if (!result.ok) {
    throw new HttpError(400, result.error ?? "Kode OTP salah atau kedaluwarsa");
  }
}
