import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { checkRateLimit } from "@/lib/rateLimit.js";
import * as whatsappService from "@/services/whatsapp.service.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function requestOtp(
  phone: string,
  purpose: string
): Promise<{ ok: true }> {
  const allowed = checkRateLimit(
    `otp:${phone}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!allowed) {
    throw new HttpError(
      429,
      "Terlalu banyak permintaan OTP, coba lagi dalam satu menit"
    );
  }
  const code = generateOtpCode();
  await db.otpCode.create({
    data: {
      phone,
      purpose,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  await whatsappService.sendMessage(
    phone,
    `Kode OTP kamu: ${code}. Berlaku 5 menit, jangan bagikan ke siapa pun.`
  );
  return { ok: true };
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ ok: true }> {
  const record = await db.otpCode.findFirst({
    where: { phone, codeHash: hashOtpCode(code), consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!record) {
    throw new HttpError(400, "Kode OTP salah atau sudah dipakai");
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "Kode OTP sudah kedaluwarsa");
  }
  await db.otpCode.update({
    where: { id: record.id },
    data: { consumed: true },
  });
  return { ok: true };
}
