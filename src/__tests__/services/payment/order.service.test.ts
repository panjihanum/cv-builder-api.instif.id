import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as orderService from "@/services/payment/order.service.js";

const mockOrder = {
  id: "order-1",
  method: "MANUAL",
  amount: 10000,
  packs: 1,
  status: "PENDING",
  reference: null,
  proofUrl: null,
  paidAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("order.service createCheckout manual", () => {
  it("membuat order dengan harga packs kali packPrice dan info rekening", async () => {
    vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
      where: { key: string };
    }) => {
      if (args.where.key === "pricing.packPrice") {
        return {
          id: "s1",
          key: args.where.key,
          value: "15000",
          encrypted: false,
          updatedAt: new Date(),
        };
      }
      if (args.where.key === "manual.methods") {
        return {
          id: "s2",
          key: args.where.key,
          value: JSON.stringify([
            {
              id: "m1",
              type: "bank_transfer",
              label: "BCA",
              isActive: true,
              bankName: "BCA",
              accountNumber: "1234567890",
              accountHolder: "PT Instif",
            },
          ]),
          encrypted: false,
          updatedAt: new Date(),
        };
      }
      return null;
    }) as never);
    vi.mocked(db.order.create).mockResolvedValue({
      ...mockOrder,
      amount: 30000,
      packs: 2,
    } as never);
    const result = await orderService.createCheckout("user-1", "MANUAL", 2);
    const createArgs = vi.mocked(db.order.create).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      userId: "user-1",
      method: "MANUAL",
      packs: 2,
      amount: 30000,
    });
    expect(result.order.amount).toBe(30000);
    expect("manualMethods" in result && result.manualMethods).toMatchObject([
      {
        id: "m1",
        type: "bank_transfer",
        label: "BCA",
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "PT Instif",
      },
    ]);
  });
});

describe("order.service getOwnedOrder", () => {
  it("melempar 404 untuk order milik user lain", async () => {
    vi.mocked(db.order.findFirst).mockResolvedValue(null);
    await expect(
      orderService.getOwnedOrder("user-2", "order-1")
    ).rejects.toMatchObject({ status: 404 });
    const args = vi.mocked(db.order.findFirst).mock.calls[0][0];
    expect(args?.where).toEqual({ id: "order-1", userId: "user-2" });
  });
});

describe("order.service attachProof", () => {
  it("menyimpan proofUrl pada order pending milik user", async () => {
    vi.mocked(db.order.findFirst).mockResolvedValue(mockOrder as never);
    vi.mocked(db.order.update).mockResolvedValue({
      ...mockOrder,
      proofUrl: "/uploads/bukti.png",
    } as never);
    const order = await orderService.attachProof(
      "user-1",
      "order-1",
      "/uploads/bukti.png"
    );
    expect(order.proofUrl).toBe("/uploads/bukti.png");
  });

  it("menolak upload bukti untuk order yang sudah diproses", async () => {
    vi.mocked(db.order.findFirst).mockResolvedValue({
      ...mockOrder,
      status: "PAID",
    } as never);
    await expect(
      orderService.attachProof("user-1", "order-1", "/uploads/bukti.png")
    ).rejects.toMatchObject({ status: 400 });
    expect(db.order.update).not.toHaveBeenCalled();
  });
});
