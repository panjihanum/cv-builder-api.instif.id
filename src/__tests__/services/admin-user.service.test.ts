import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import * as adminUserService from "@/services/admin-user.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin-user.service listUsers", () => {
  it("memetakan saldo kredit dan tanpa filter saat search kosong", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([
      {
        id: "u1",
        name: "Budi",
        email: null,
        phone: "628111",
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        credit: { balance: 7 },
      },
    ] as never);
    vi.mocked(db.user.count).mockResolvedValue(1 as never);
    const result = await adminUserService.listUsers();
    expect(result.items[0].credit).toBe(7);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    const args = vi.mocked(db.user.findMany).mock.calls[0][0];
    expect(args?.where).toEqual({});
  });

  it("membuat filter OR saat ada search", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    vi.mocked(db.user.count).mockResolvedValue(0 as never);
    await adminUserService.listUsers("budi");
    const args = vi.mocked(db.user.findMany).mock.calls[0][0];
    expect(args?.where).toHaveProperty("OR");
  });

  it("menerapkan skip/take sesuai halaman", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    vi.mocked(db.user.count).mockResolvedValue(45 as never);
    const result = await adminUserService.listUsers(undefined, 3, 20);
    const args = vi.mocked(db.user.findMany).mock.calls[0][0];
    expect(args?.skip).toBe(40);
    expect(args?.take).toBe(20);
    expect(result.totalPages).toBe(3);
  });
});

describe("admin-user.service adjustCredit", () => {
  it("menambah kredit pada saldo berjalan", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(db.credit.findUnique).mockResolvedValue({ balance: 5 } as never);
    vi.mocked(db.credit.upsert).mockResolvedValue({ balance: 8 } as never);
    const result = await adminUserService.adjustCredit("u1", 3, "add");
    expect(result.balance).toBe(8);
    const args = vi.mocked(db.credit.upsert).mock.calls[0][0];
    expect(args.update).toEqual({ balance: 8 });
  });

  it("menetapkan saldo persis saat mode set", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(db.credit.upsert).mockResolvedValue({ balance: 50 } as never);
    const result = await adminUserService.adjustCredit("u1", 50, "set");
    expect(result.balance).toBe(50);
  });

  it("menolak user tidak ditemukan", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    await expect(
      adminUserService.adjustCredit("ghost", 5, "add")
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("admin-user.service updateUser", () => {
  it("memperbarui role lalu mengembalikan view terbaru", async () => {
    vi.mocked(db.user.findUnique)
      .mockResolvedValueOnce({ id: "u1" } as never)
      .mockResolvedValueOnce({
        id: "u1",
        name: "Budi",
        email: null,
        phone: "628111",
        role: "ADMIN",
        status: "ACTIVE",
        createdAt: new Date(),
        credit: { balance: 0 },
      } as never);
    vi.mocked(db.user.update).mockResolvedValue({} as never);
    const user = await adminUserService.updateUser("u1", { role: "ADMIN" });
    expect(user.role).toBe("ADMIN");
    const args = vi.mocked(db.user.update).mock.calls[0][0];
    expect(args.data).toEqual({ role: "ADMIN" });
  });
});
