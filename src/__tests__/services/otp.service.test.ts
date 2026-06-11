import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { resetRateLimits } from "@/lib/rateLimit.js";
import * as otpService from "@/services/otp.service.js";
import * as whatsappService from "@/services/whatsapp.service.js";

vi.mock("@/services/whatsapp.service.js", () => ({
  sendMessage: vi.fn(),
}));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
});

describe("otp.service requestOtp", () => {
  it("menyimpan hash sha256 dengan masa berlaku 5 menit dan mengirim via wa", async () => {
    vi.mocked(db.otpCode.create).mockResolvedValue({} as never);
    const before = Date.now();
    const result = await otpService.requestOtp("08123456789", "VERIFY_PHONE");
    expect(result).toEqual({ ok: true });
    const createArgs = vi.mocked(db.otpCode.create).mock.calls[0][0];
    expect(createArgs.data.phone).toBe("08123456789");
    expect(createArgs.data.purpose).toBe("VERIFY_PHONE");
    expect(createArgs.data.codeHash).toMatch(/^[a-f0-9]{64}$/);
    const expiresAt = (createArgs.data.expiresAt as Date).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 4 * 60 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
    const message = vi.mocked(whatsappService.sendMessage).mock.calls[0][1];
    const code = message.match(/\d{6}/)?.[0] ?? "";
    expect(sha256(code)).toBe(createArgs.data.codeHash);
  });

  it("melempar 429 setelah tiga permintaan dalam satu menit", async () => {
    vi.mocked(db.otpCode.create).mockResolvedValue({} as never);
    await otpService.requestOtp("0811111111", "LOGIN");
    await otpService.requestOtp("0811111111", "LOGIN");
    await otpService.requestOtp("0811111111", "LOGIN");
    await expect(
      otpService.requestOtp("0811111111", "LOGIN")
    ).rejects.toMatchObject({ status: 429 });
    expect(db.otpCode.create).toHaveBeenCalledTimes(3);
  });

  it("meneruskan 503 saat whatsapp belum terhubung", async () => {
    vi.mocked(db.otpCode.create).mockResolvedValue({} as never);
    vi.mocked(whatsappService.sendMessage).mockRejectedValue(
      new HttpError(503, "WhatsApp belum terhubung")
    );
    await expect(
      otpService.requestOtp("0822222222", "LOGIN")
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("otp.service verifyOtp", () => {
  const record = {
    id: "otp-1",
    phone: "08123456789",
    codeHash: sha256("123456"),
    purpose: "VERIFY_PHONE",
    expiresAt: new Date(Date.now() + 60_000),
    consumed: false,
    createdAt: new Date(),
  };

  it("memverifikasi kode valid dan menandai consumed", async () => {
    vi.mocked(db.otpCode.findFirst).mockResolvedValue(record as never);
    vi.mocked(db.otpCode.update).mockResolvedValue({} as never);
    const result = await otpService.verifyOtp("08123456789", "123456");
    expect(result).toEqual({ ok: true });
    const findArgs = vi.mocked(db.otpCode.findFirst).mock.calls[0][0];
    expect(findArgs?.where).toEqual({
      phone: "08123456789",
      codeHash: sha256("123456"),
      consumed: false,
    });
    expect(db.otpCode.update).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { consumed: true },
    });
  });

  it("menolak kode salah atau sudah dipakai dengan 400", async () => {
    vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
    await expect(
      otpService.verifyOtp("08123456789", "999999")
    ).rejects.toMatchObject({ status: 400 });
    expect(db.otpCode.update).not.toHaveBeenCalled();
  });

  it("menolak kode kedaluwarsa dengan 400 tanpa menandai consumed", async () => {
    vi.mocked(db.otpCode.findFirst).mockResolvedValue({
      ...record,
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    await expect(
      otpService.verifyOtp("08123456789", "123456")
    ).rejects.toMatchObject({ status: 400 });
    expect(db.otpCode.update).not.toHaveBeenCalled();
  });
});
