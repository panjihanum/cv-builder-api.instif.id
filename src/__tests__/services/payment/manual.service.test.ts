import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as manualService from "@/services/payment/manual.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("manual.service getBankAccounts", () => {
  it("mengembalikan array kosong saat setting tidak valid", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "bank.accounts",
      value: "bukan-json",
      encrypted: false,
      updatedAt: new Date(),
    } as never);
    expect(await manualService.getBankAccounts()).toEqual([]);
  });

  it("mengembalikan array kosong saat setting belum diisi", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    expect(await manualService.getBankAccounts()).toEqual([]);
  });
});

describe("manual.service approvePayment", () => {
  const pendingOrder = {
    id: "order-1",
    userId: "user-1",
    method: "MANUAL",
    amount: 10000,
    packs: 1,
    status: "PENDING",
  };

  it("menandai paid dan menambah kredit", async () => {
    vi.mocked(db.order.findUnique)
      .mockResolvedValueOnce(pendingOrder as never)
      .mockResolvedValueOnce({ ...pendingOrder, status: "PAID" } as never);
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.upsert).mockResolvedValue({} as never);
    const order = await manualService.approvePayment("order-1");
    expect(order?.status).toBe("PAID");
    expect(db.credit.upsert).toHaveBeenCalledTimes(1);
  });

  it("idempoten saat approve dipanggil dua kali", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      ...pendingOrder,
      status: "PAID",
    } as never);
    await manualService.approvePayment("order-1");
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.credit.upsert).not.toHaveBeenCalled();
  });
});

describe("manual.service rejectPayment", () => {
  it("melempar 404 saat order tidak ada", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(null);
    await expect(manualService.rejectPayment("order-x")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("menolak reject untuk order yang sudah paid", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: "order-1",
      status: "PAID",
    } as never);
    await expect(manualService.rejectPayment("order-1")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("mengubah status order menjadi rejected", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue({
      id: "order-1",
      status: "PENDING",
    } as never);
    vi.mocked(db.order.update).mockResolvedValue({
      id: "order-1",
      status: "REJECTED",
    } as never);
    const order = await manualService.rejectPayment("order-1");
    expect(order.status).toBe("REJECTED");
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "REJECTED" },
    });
  });
});
