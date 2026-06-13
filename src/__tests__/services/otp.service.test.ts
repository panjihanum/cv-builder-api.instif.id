import { describe, it, expect, beforeEach, vi } from "vitest";
import * as otpService from "@/services/otp.service.js";
import * as waGateway from "@/lib/waGateway.js";

vi.mock("@/lib/waGateway.js", () => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("otp.service requestOtp", () => {
  it("menormalkan nomor dan meneruskan purpose LOGIN ke gateway", async () => {
    const result = await otpService.requestOtp("08123456789", "LOGIN");
    expect(result).toEqual({ ok: true });
    expect(waGateway.requestOtp).toHaveBeenCalledWith("628123456789", "LOGIN");
  });

  it("memetakan purpose lain menjadi VERIFY_PHONE", async () => {
    await otpService.requestOtp("08123456789", "VERIFY_PHONE");
    expect(waGateway.requestOtp).toHaveBeenCalledWith(
      "628123456789",
      "VERIFY_PHONE"
    );
  });

  it("meneruskan error dari gateway", async () => {
    vi.mocked(waGateway.requestOtp).mockRejectedValue(new Error("offline"));
    await expect(
      otpService.requestOtp("0822222222", "LOGIN")
    ).rejects.toThrow();
  });
});

describe("otp.service verifyOtp", () => {
  it("menormalkan nomor dan meneruskan kode ke gateway", async () => {
    const result = await otpService.verifyOtp("08123456789", "123456");
    expect(result).toEqual({ ok: true });
    expect(waGateway.verifyOtp).toHaveBeenCalledWith("628123456789", "123456");
  });

  it("meneruskan error verifikasi dari gateway", async () => {
    vi.mocked(waGateway.verifyOtp).mockRejectedValue(new Error("bad code"));
    await expect(
      otpService.verifyOtp("08123456789", "999999")
    ).rejects.toThrow();
  });
});
