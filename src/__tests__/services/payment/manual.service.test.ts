import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as manualService from "@/services/payment/manual.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("manual.service getActiveMethods", () => {
  it("mengembalikan array kosong saat setting tidak valid", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "manual.methods",
      value: "bukan-json",
      encrypted: false,
      updatedAt: new Date(),
    } as never);
    expect(await manualService.getActiveMethods()).toEqual([]);
  });

  it("mengembalikan array kosong saat setting belum diisi", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    expect(await manualService.getActiveMethods()).toEqual([]);
  });

  it("hanya mengembalikan metode yang aktif", async () => {
    vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
      where: { key: string };
    }) => {
      if (args.where.key === "manual.methods") {
        return {
          id: "s1",
          key: "manual.methods",
          value: JSON.stringify([
            { id: "m1", type: "bank_transfer", label: "BCA", isActive: true },
            { id: "m2", type: "qris", label: "QRIS", isActive: false },
          ]),
          encrypted: false,
          updatedAt: new Date(),
        };
      }
      return null;
    }) as never);
    const active = await manualService.getActiveMethods();
    expect(active.map((m) => m.id)).toEqual(["m1"]);
  });

  it("migrasi otomatis dari bank.accounts lama ke manual.methods", async () => {
    vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
      where: { key: string };
    }) => {
      if (args.where.key === "bank.accounts") {
        return {
          id: "s2",
          key: "bank.accounts",
          value: JSON.stringify([
            {
              bankName: "BCA",
              accountNumber: "123",
              accountHolder: "PT Instif",
            },
          ]),
          encrypted: false,
          updatedAt: new Date(),
        };
      }
      return null;
    }) as never);
    vi.mocked(db.setting.upsert).mockResolvedValue({} as never);
    const methods = await manualService.getActiveMethods();
    expect(methods).toHaveLength(1);
    expect(methods[0]).toMatchObject({
      type: "bank_transfer",
      label: "BCA",
      bankName: "BCA",
      accountNumber: "123",
      accountHolder: "PT Instif",
      isActive: true,
    });
    expect(db.setting.upsert).toHaveBeenCalled();
  });
});

describe("manual.service CRUD", () => {
  function mockMethodsStore(initial: unknown[]) {
    let store = JSON.stringify(initial);
    vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
      where: { key: string };
    }) => {
      if (args.where.key === "manual.methods") {
        return {
          id: "s1",
          key: "manual.methods",
          value: store,
          encrypted: false,
          updatedAt: new Date(),
        };
      }
      return null;
    }) as never);
    vi.mocked(db.setting.upsert).mockImplementation((async (args: {
      create: { value: string };
    }) => {
      store = args.create.value;
      invalidateSettingsCache();
      return {} as never;
    }) as never);
  }

  it("createMethod menambah metode baru dengan id", async () => {
    mockMethodsStore([]);
    const method = await manualService.createMethod({
      type: "qris",
      label: "QRIS Toko",
      isActive: true,
    });
    expect(method.id).toBeTruthy();
    expect(method.label).toBe("QRIS Toko");
  });

  it("updateMethod melempar 404 untuk id tidak dikenal", async () => {
    mockMethodsStore([]);
    await expect(
      manualService.updateMethod("nope", { label: "X" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("toggleMethod membalik status aktif", async () => {
    mockMethodsStore([
      { id: "m1", type: "bank_transfer", label: "BCA", isActive: true },
    ]);
    const method = await manualService.toggleMethod("m1");
    expect(method.isActive).toBe(false);
  });

  it("deleteMethod menghapus metode", async () => {
    mockMethodsStore([
      { id: "m1", type: "bank_transfer", label: "BCA", isActive: true },
    ]);
    await manualService.deleteMethod("m1");
    expect(await manualService.getAllMethods()).toEqual([]);
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

describe("manual.service listPaymentsForAdmin", () => {
  it("mengembalikan bentuk paginasi dengan skip/take", async () => {
    vi.mocked(db.order.findMany).mockResolvedValue([] as never);
    vi.mocked(db.order.count).mockResolvedValue(35 as never);
    const result = await manualService.listPaymentsForAdmin("PENDING", 2, 20);
    const args = vi.mocked(db.order.findMany).mock.calls[0][0];
    expect(args?.skip).toBe(20);
    expect(args?.take).toBe(20);
    expect(args?.where).toEqual({ status: "PENDING" });
    expect(result.total).toBe(35);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
  });
});

describe("manual.service bulk actions", () => {
  it("approvePayments mengumpulkan sukses dan gagal", async () => {
    vi.mocked(db.order.findUnique)
      .mockResolvedValueOnce({
        id: "order-1",
        userId: "user-1",
        packs: 1,
        status: "PENDING",
      } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.upsert).mockResolvedValue({} as never);

    const result = await manualService.approvePayments(["order-1", "order-2"]);
    expect(result.succeeded).toEqual(["order-1"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe("order-2");
  });

  it("rejectPayments melewati order yang sudah paid", async () => {
    vi.mocked(db.order.findUnique)
      .mockResolvedValueOnce({ id: "order-1", status: "PENDING" } as never)
      .mockResolvedValueOnce({ id: "order-2", status: "PAID" } as never);
    vi.mocked(db.order.update).mockResolvedValue({
      id: "order-1",
      status: "REJECTED",
    } as never);

    const result = await manualService.rejectPayments(["order-1", "order-2"]);
    expect(result.succeeded).toEqual(["order-1"]);
    expect(result.failed[0]).toMatchObject({ id: "order-2" });
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
