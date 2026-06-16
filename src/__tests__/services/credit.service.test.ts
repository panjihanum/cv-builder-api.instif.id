import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as creditService from "@/services/credit.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
  vi.mocked(db.exportQuota.findUnique).mockResolvedValue(null);
  vi.mocked(db.exportQuota.create).mockResolvedValue({} as never);
  vi.mocked(db.exportQuota.update).mockResolvedValue({} as never);
});

describe("credit.service ensureCredit", () => {
  it("membuat row credit baru saat belum ada dan mengembalikan saldo", async () => {
    vi.mocked(db.credit.upsert).mockResolvedValue({
      id: "c1",
      userId: "user-1",
      balance: 0,
    } as never);
    expect(await creditService.ensureCredit("user-1")).toBe(0);
    const args = vi.mocked(db.credit.upsert).mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1" });
    expect(args.create).toEqual({ userId: "user-1" });
  });
});

describe("credit.service getCreditBalance", () => {
  it("mengembalikan nol saat user belum punya record credit", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue(null);
    expect(await creditService.getCreditBalance("user-1")).toBe(0);
  });

  it("mengembalikan saldo credit user", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      id: "c1",
      userId: "user-1",
      balance: 7,
    } as never);
    expect(await creditService.getCreditBalance("user-1")).toBe(7);
  });
});

describe("credit.service assertCreditBalance", () => {
  it("lolos saat saldo cukup", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      balance: 3,
    } as never);
    await expect(
      creditService.assertCreditBalance("user-1", 3)
    ).resolves.toBeUndefined();
  });

  it("melempar 402 saat saldo kurang", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      balance: 2,
    } as never);
    await expect(
      creditService.assertCreditBalance("user-1", 3)
    ).rejects.toMatchObject({ status: 402 });
  });
});

describe("credit.service consumeCredits", () => {
  it("mendekremen saldo dengan guard saldo cukup", async () => {
    vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      balance: 12,
    } as never);
    const sisa = await creditService.consumeCredits("user-1", 3);
    expect(sisa).toBe(12);
    const args = vi.mocked(db.credit.updateMany).mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1", balance: { gte: 3 } });
    expect(args.data).toEqual({ balance: { decrement: 3 } });
  });

  it("melempar 402 saat saldo tidak cukup", async () => {
    vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(
      creditService.consumeCredits("user-1", 5)
    ).rejects.toMatchObject({ status: 402 });
  });
});

describe("credit.service settleOrderPaid", () => {
  const pendingOrder = {
    id: "order-1",
    userId: "user-1",
    method: "MANUAL",
    amount: 10000,
    packs: 2,
    status: "PENDING",
  };

  it("melempar 404 saat order tidak ditemukan", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(null);
    await expect(
      creditService.settleOrderPaid("order-x")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("idempoten saat order sudah dibayar", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      ...pendingOrder,
      status: "PAID",
    } as never);
    const result = await creditService.settleOrderPaid("order-1");
    expect(result.alreadyPaid).toBe(true);
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.credit.upsert).not.toHaveBeenCalled();
  });

  it("menandai paid dan menambah packs kali creditsPerPack dalam transaksi", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(pendingOrder as never);
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.upsert).mockResolvedValue({} as never);
    const result = await creditService.settleOrderPaid("order-1");
    expect(result.alreadyPaid).toBe(false);
    const orderArgs = vi.mocked(db.order.updateMany).mock.calls[0][0];
    expect(orderArgs.where).toEqual({
      id: "order-1",
      status: { not: "PAID" },
    });
    expect(orderArgs.data).toMatchObject({ status: "PAID" });
    const creditArgs = vi.mocked(db.credit.upsert).mock.calls[0][0];
    expect(creditArgs.update).toEqual({ balance: { increment: 30 } });
    expect(creditArgs.create).toEqual({ userId: "user-1", balance: 30 });
  });

  it("memakai creditsPerPack dari settings saat tersedia", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(pendingOrder as never);
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "pricing.creditsPerPack",
      value: "20",
      encrypted: false,
      updatedAt: new Date(),
    } as never);
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.upsert).mockResolvedValue({} as never);
    await creditService.settleOrderPaid("order-1");
    const creditArgs = vi.mocked(db.credit.upsert).mock.calls[0][0];
    expect(creditArgs.update).toEqual({ balance: { increment: 40 } });
  });

  it("tidak menambah kredit saat race membuat order sudah paid", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(pendingOrder as never);
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 0 } as never);
    await creditService.settleOrderPaid("order-1");
    expect(db.credit.upsert).not.toHaveBeenCalled();
  });
});
