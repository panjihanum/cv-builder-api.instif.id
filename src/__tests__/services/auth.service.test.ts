import { describe, it, expect, beforeEach, vi } from "vitest";
import bcryptjs from "bcryptjs";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import * as authService from "@/services/auth.service.js";
import * as waGateway from "@/lib/waGateway.js";
import * as email from "@/lib/email.js";
import * as verification from "@/lib/verification.js";

vi.mock("@/lib/waGateway.js", () => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/email.js", () => ({
  isEmailConfigured: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/verification.js", () => ({
  createVerificationToken: vi.fn(),
  consumeVerificationToken: vi.fn(),
}));

const mockUser = {
  id: "user-1",
  name: "Budi",
  email: "budi@instif.id",
  phone: null as string | null,
  password: "",
  emailVerified: new Date("2026-01-01T00:00:00Z") as Date | null,
  role: "USER",
  status: "ACTIVE",
};

beforeEach(async () => {
  vi.clearAllMocks();
  mockUser.password = await bcryptjs.hash("password123", 4);
  mockUser.emailVerified = new Date("2026-01-01T00:00:00Z");
  vi.mocked(email.isEmailConfigured).mockResolvedValue(true);
  vi.mocked(email.sendVerificationEmail).mockResolvedValue(undefined);
  vi.mocked(verification.createVerificationToken).mockResolvedValue(
    "verif-tok"
  );
});

describe("auth.service register", () => {
  it("menolak pendaftaran saat SMTP belum dikonfigurasi (503)", async () => {
    vi.mocked(email.isEmailConfigured).mockResolvedValue(false);
    await expect(
      authService.register({
        name: "Budi",
        email: "budi@instif.id",
        password: "password123",
      })
    ).rejects.toMatchObject({ status: 503 });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("menolak email yang sudah terdaftar dengan status 400", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as never);
    await expect(
      authService.register({
        name: "Budi",
        email: "budi@instif.id",
        password: "password123",
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("membuat user belum terverifikasi, kirim email, dan tidak mengembalikan token", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(mockUser as never);
    const result = await authService.register({
      name: "Budi",
      email: "Budi@Instif.ID",
      password: "password123",
    });
    const createArgs = vi.mocked(db.user.create).mock.calls[0][0];
    expect(createArgs.data.email).toBe("budi@instif.id"); // lowercased
    expect(createArgs.data.password).not.toBe("password123");
    expect(createArgs.data.emailVerified).toBeUndefined();
    expect(createArgs.data.credit).toEqual({ create: {} });
    expect(verification.createVerificationToken).toHaveBeenCalledWith(
      "budi@instif.id"
    );
    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      "budi@instif.id",
      "verif-tok"
    );
    expect(result).toEqual({
      pendingVerification: true,
      email: "budi@instif.id",
    });
    expect(result).not.toHaveProperty("token");
  });
});

describe("auth.service login", () => {
  it("menolak email tidak terdaftar dengan status 401", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    await expect(
      authService.login({ email: "x@instif.id", password: "password123" })
    ).rejects.toMatchObject({ status: 401 });
  });

  it("menolak password salah dengan status 401", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as never);
    await expect(
      authService.login({ email: "budi@instif.id", password: "salah" })
    ).rejects.toMatchObject({ status: 401 });
  });

  it("menolak login bila email belum diverifikasi (403)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...mockUser,
      emailVerified: null,
    } as never);
    await expect(
      authService.login({ email: "budi@instif.id", password: "password123" })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("menolak akun non-aktif dengan status 403", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...mockUser,
      status: "SUSPENDED",
    } as never);
    await expect(
      authService.login({ email: "budi@instif.id", password: "password123" })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("mengembalikan token dan user tanpa password saat sukses", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as never);
    const result = await authService.login({
      email: "Budi@instif.id",
      password: "password123",
    });
    // email is normalised before lookup
    expect(vi.mocked(db.user.findUnique).mock.calls[0][0]).toEqual({
      where: { email: "budi@instif.id" },
    });
    expect(result.token).toBeTruthy();
    expect(result.user).not.toHaveProperty("password");
    expect(result.user.email).toBe("budi@instif.id");
  });
});

describe("auth.service verifyEmail", () => {
  it("menandai email terverifikasi untuk token valid", async () => {
    vi.mocked(verification.consumeVerificationToken).mockResolvedValue({
      status: "valid",
      email: "budi@instif.id",
    });
    const status = await authService.verifyEmail("verif-tok");
    expect(status).toBe("success");
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { email: "budi@instif.id", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
  });

  it("mengembalikan 'expired' tanpa update untuk token kedaluwarsa", async () => {
    vi.mocked(verification.consumeVerificationToken).mockResolvedValue({
      status: "expired",
    });
    expect(await authService.verifyEmail("old")).toBe("expired");
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("mengembalikan 'invalid' untuk token tidak dikenal", async () => {
    vi.mocked(verification.consumeVerificationToken).mockResolvedValue({
      status: "invalid",
    });
    expect(await authService.verifyEmail("nope")).toBe("invalid");
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("auth.service resendVerification", () => {
  it("kirim ulang untuk akun email yang belum terverifikasi", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...mockUser,
      emailVerified: null,
    } as never);
    const result = await authService.resendVerification("Budi@instif.id");
    expect(result).toEqual({ ok: true });
    expect(email.sendVerificationEmail).toHaveBeenCalledWith(
      "budi@instif.id",
      "verif-tok"
    );
  });

  it("tidak mengirim jika sudah terverifikasi, tetap ok (anti-enumerasi)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as never);
    const result = await authService.resendVerification("budi@instif.id");
    expect(result).toEqual({ ok: true });
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("tidak mengirim untuk email tidak dikenal, tetap ok", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const result = await authService.resendVerification("ghost@instif.id");
    expect(result).toEqual({ ok: true });
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("tidak mengirim bila SMTP belum dikonfigurasi, tetap ok", async () => {
    vi.mocked(email.isEmailConfigured).mockResolvedValue(false);
    const result = await authService.resendVerification("budi@instif.id");
    expect(result).toEqual({ ok: true });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(email.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("auth.service requestPhoneOtp", () => {
  it("menormalkan nomor dan meminta OTP LOGIN ke gateway", async () => {
    const result = await authService.requestPhoneOtp("08123456789");
    expect(result).toEqual({ ok: true });
    expect(waGateway.requestOtp).toHaveBeenCalledWith("628123456789", "LOGIN");
  });
});

describe("auth.service verifyPhoneOtp", () => {
  it("masuk untuk user lama tanpa membuat user baru", async () => {
    vi.mocked(waGateway.verifyOtp).mockResolvedValue(undefined);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...mockUser,
      phone: "628123456789",
    } as never);
    const result = await authService.verifyPhoneOtp({
      phone: "08123456789",
      code: "123456",
    });
    expect(waGateway.verifyOtp).toHaveBeenCalledWith("628123456789", "123456");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(result.token).toBeTruthy();
  });

  it("membuat user baru dengan phone ter-normalisasi dan credit kosong", async () => {
    vi.mocked(waGateway.verifyOtp).mockResolvedValue(undefined);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue({
      id: "user-2",
      name: "User 6789",
      email: null,
      phone: "628123456789",
      role: "USER",
      status: "ACTIVE",
    } as never);
    const result = await authService.verifyPhoneOtp({
      phone: "08123456789",
      code: "123456",
    });
    const createArgs = vi.mocked(db.user.create).mock.calls[0][0];
    expect(createArgs.data.phone).toBe("628123456789");
    expect(createArgs.data.credit).toEqual({ create: {} });
    expect(result.user.phone).toBe("628123456789");
    expect(result.token).toBeTruthy();
  });

  it("menolak kode salah dari gateway", async () => {
    vi.mocked(waGateway.verifyOtp).mockRejectedValue(
      new HttpError(400, "Kode OTP salah atau kedaluwarsa")
    );
    await expect(
      authService.verifyPhoneOtp({ phone: "08123456789", code: "999999" })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("auth.service getMe", () => {
  it("mengembalikan 404 saat user tidak ditemukan", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    await expect(authService.getMe("ghost")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("mengembalikan data publik user", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as never);
    const user = await authService.getMe("user-1");
    expect(user).toEqual({
      id: "user-1",
      name: "Budi",
      email: "budi@instif.id",
      phone: null,
      role: "USER",
    });
  });
});
