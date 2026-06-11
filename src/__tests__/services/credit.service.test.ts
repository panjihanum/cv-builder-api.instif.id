import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import * as creditService from "@/services/credit.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("credit.service getCredit", () => {
  it("mengembalikan nol saat user belum punya record credit", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue(null);
    expect(await creditService.getCredit("user-1")).toEqual({
      exportLeft: 0,
      aiUploadsLeft: 0,
    });
  });

  it("mengembalikan saldo credit user", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      id: "c1",
      userId: "user-1",
      exportLeft: 2,
      aiUploadsLeft: 5,
    } as never);
    expect(await creditService.getCredit("user-1")).toEqual({
      exportLeft: 2,
      aiUploadsLeft: 5,
    });
  });
});

describe("credit.service consumeExportCredit", () => {
  it("mendekremen dengan guard saldo lebih dari nol", async () => {
    vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      exportLeft: 1,
      aiUploadsLeft: 3,
    } as never);
    const sisa = await creditService.consumeExportCredit("user-1");
    expect(sisa).toBe(1);
    const args = vi.mocked(db.credit.updateMany).mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1", exportLeft: { gt: 0 } });
    expect(args.data).toEqual({ exportLeft: { decrement: 1 } });
  });

  it("melempar 402 saat saldo export nol", async () => {
    vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(
      creditService.consumeExportCredit("user-1")
    ).rejects.toMatchObject({ status: 402 });
  });
});

describe("credit.service consumeAiUploadCredit", () => {
  it("mendekremen kuota ai dan mengembalikan sisa", async () => {
    vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      exportLeft: 1,
      aiUploadsLeft: 2,
    } as never);
    const sisa = await creditService.consumeAiUploadCredit("user-1");
    expect(sisa).toBe(2);
    const args = vi.mocked(db.credit.updateMany).mock.calls[0][0];
    expect(args.where).toEqual({
      userId: "user-1",
      aiUploadsLeft: { gt: 0 },
    });
  });

  it("melempar 402 saat kuota ai habis", async () => {
    vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 0 } as never);
    await expect(
      creditService.consumeAiUploadCredit("user-1")
    ).rejects.toMatchObject({ status: 402 });
  });
});

describe("credit.service topUpCredits", () => {
  it("menambah 1 export dan 3 ai upload per pack", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    vi.mocked(db.credit.upsert).mockResolvedValue({} as never);
    await creditService.topUpCredits("user-1", 2);
    const args = vi.mocked(db.credit.upsert).mock.calls[0][0];
    expect(args.update).toEqual({
      exportLeft: { increment: 2 },
      aiUploadsLeft: { increment: 6 },
    });
    expect(args.create).toEqual({
      userId: "user-1",
      exportLeft: 2,
      aiUploadsLeft: 6,
    });
  });
});

describe("credit.service settleOrderPaid", () => {
  const pendingOrder = {
    id: "order-1",
    userId: "user-1",
    method: "MANUAL",
    amount: 10000,
    packs: 1,
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

  it("menandai paid dan menambah kredit dalam transaksi", async () => {
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
    expect(creditArgs.update).toEqual({
      exportLeft: { increment: 1 },
      aiUploadsLeft: { increment: 3 },
    });
  });

  it("tidak menambah kredit saat race membuat order sudah paid", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(pendingOrder as never);
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 0 } as never);
    await creditService.settleOrderPaid("order-1");
    expect(db.credit.upsert).not.toHaveBeenCalled();
  });
});
