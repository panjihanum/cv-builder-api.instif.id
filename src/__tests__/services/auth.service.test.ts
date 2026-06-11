import { describe, it, expect, beforeEach, vi } from "vitest";
import bcryptjs from "bcryptjs";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import * as authService from "@/services/auth.service.js";

const mockUser = {
  id: "user-1",
  name: "Budi",
  email: "budi@instif.id",
  password: "",
  role: "USER",
  status: "ACTIVE",
};

beforeEach(async () => {
  vi.clearAllMocks();
  mockUser.password = await bcryptjs.hash("password123", 4);
});

describe("auth.service register", () => {
  it("menolak email yang sudah terdaftar dengan status 400", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as never);
    const promise = authService.register({
      name: "Budi",
      email: "budi@instif.id",
      password: "password123",
    });
    await expect(promise).rejects.toThrow(HttpError);
    await expect(
      authService.register({
        name: "Budi",
        email: "budi@instif.id",
        password: "password123",
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("membuat user baru dengan password ter-hash dan credit kosong", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(mockUser as never);
    const result = await authService.register({
      name: "Budi",
      email: "budi@instif.id",
      password: "password123",
    });
    const createArgs = vi.mocked(db.user.create).mock.calls[0][0];
    expect(createArgs.data.password).not.toBe("password123");
    expect(createArgs.data.credit).toEqual({ create: {} });
    expect(result.token).toBeTruthy();
    expect(result.user).toEqual({
      id: "user-1",
      name: "Budi",
      email: "budi@instif.id",
      role: "USER",
    });
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
      email: "budi@instif.id",
      password: "password123",
    });
    expect(result.token).toBeTruthy();
    expect(result.user).not.toHaveProperty("password");
    expect(result.user.email).toBe("budi@instif.id");
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
      role: "USER",
    });
  });
});
