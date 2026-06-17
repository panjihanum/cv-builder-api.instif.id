import { env } from "@/lib/env.js";
import { HttpError } from "@/lib/httpError.js";

interface Gateway {
  url: string;
  secret: string;
}

/**
 * Parses WA_GATEWAYS env var ("url1|secret1,url2|secret2") into an ordered list.
 * Falls back to WA_GATEWAY_URL + WA_GATEWAY_SECRET for backward compatibility.
 */
function loadGateways(): Gateway[] {
  const multi = env.WA_GATEWAYS?.trim();
  if (multi) {
    return multi.split(",").flatMap((pair) => {
      const sep = pair.lastIndexOf("|");
      if (sep === -1) return [];
      const url = pair.slice(0, sep).trim();
      const secret = pair.slice(sep + 1).trim();
      return url ? [{ url, secret }] : [];
    });
  }
  return [{ url: env.WA_GATEWAY_URL, secret: env.WA_GATEWAY_SECRET }];
}

const GATEWAYS = loadGateways();

async function callOne(
  gw: Gateway,
  path: string,
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${gw.url}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gw.secret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: "Gateway tidak merespons" };
  }
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return { ok: res.ok && data.ok !== false, error: data.error };
}

/** Tries each gateway in priority order; returns on first success. */
async function call(
  path: string,
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  let lastError = "Gateway WhatsApp tidak tersedia";
  for (const gw of GATEWAYS) {
    const result = await callOne(gw, path, body);
    if (result.ok) return result;
    lastError = result.error ?? lastError;
  }
  return { ok: false, error: lastError };
}

/**
 * Send a plain-text WhatsApp message. Fails silently so it never blocks
 * the payment flow.
 */
export async function sendMessage(
  phone: string,
  message: string
): Promise<void> {
  const result = await call("/send", {
    phone,
    message,
    appId: "cv-builder",
    purpose: "NOTIF",
  });
  if (!result.ok) {
    console.error(`[WA] Gagal kirim pesan ke ${phone}:`, result.error);
  }
}

/**
 * Send a file (image/pdf by URL) with a caption. Fails silently.
 */
export async function sendFile(
  phone: string,
  fileUrl: string,
  caption: string
): Promise<void> {
  const result = await call("/send-image", {
    phone,
    fileUrl,
    caption,
    appId: "cv-builder",
    purpose: "NOTIF",
  });
  if (!result.ok) {
    console.error(`[WA] Gagal kirim file ke ${phone}:`, result.error);
  }
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
