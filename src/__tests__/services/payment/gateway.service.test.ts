import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import { settleOrderPaid } from "@/services/credit.service.js";
import * as gatewayService from "@/services/payment/gateway.service.js";

const { fakeProvider } = vi.hoisted(() => ({
  fakeProvider: {
    id: "duitku",
    label: "Duitku",
    isConfigured: vi.fn(),
    createCharge: vi.fn(),
    parseWebhook: vi.fn(),
  },
}));

vi.mock("@/services/payment/providers/index.js", () => ({
  paymentProviders: { duitku: fakeProvider },
  getPaymentProvider: (id: string) => {
    if (id === "duitku") return fakeProvider;
    const error = new Error(`unknown ${id}`) as Error & { status: number };
    error.status = 400;
    throw error;
  },
  listProviderIds: () => ["duitku"],
}));

vi.mock("@/services/credit.service.js", () => ({
  settleOrderPaid: vi.fn(),
}));

function mockSettings(values: Record<string, string>) {
  vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
    where: { key: string };
  }) => {
    const value = values[args.where.key];
    if (value === undefined) return null;
    return {
      id: args.where.key,
      key: args.where.key,
      value,
      encrypted: false,
      updatedAt: new Date(),
    };
  }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
  fakeProvider.isConfigured.mockResolvedValue(true);
});

describe("gateway.service getActiveProviderId", () => {
  it("null saat payment.provider kosong", async () => {
    mockSettings({ "payment.provider": "" });
    expect(await gatewayService.getActiveProviderId()).toBeNull();
  });

  it("null saat provider tidak terdaftar", async () => {
    mockSettings({ "payment.provider": "midtrans" });
    expect(await gatewayService.getActiveProviderId()).toBeNull();
  });

  it("mengembalikan id provider aktif yang terdaftar", async () => {
    mockSettings({ "payment.provider": "duitku" });
    expect(await gatewayService.getActiveProviderId()).toBe("duitku");
  });
});

describe("gateway.service getActiveProvider", () => {
  it("mengembalikan label dan status konfigurasi", async () => {
    mockSettings({ "payment.provider": "duitku" });
    fakeProvider.isConfigured.mockResolvedValue(true);
    expect(await gatewayService.getActiveProvider()).toEqual({
      id: "duitku",
      label: "Duitku",
      configured: true,
    });
  });

  it("null saat tidak ada provider aktif", async () => {
    mockSettings({ "payment.provider": "" });
    expect(await gatewayService.getActiveProvider()).toBeNull();
  });
});

describe("gateway.service createGatewayCheckout", () => {
  beforeEach(() => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      name: "Budi",
      email: "budi@instif.id",
    } as never);
    vi.mocked(db.order.create).mockResolvedValue({
      id: "order-1",
      method: "DUITKU",
      amount: 20000,
      packs: 2,
      status: "PENDING",
    } as never);
    vi.mocked(db.order.update).mockResolvedValue({
      id: "order-1",
      method: "DUITKU",
      amount: 20000,
      packs: 2,
      status: "PENDING",
      reference: "REF123",
    } as never);
    fakeProvider.createCharge.mockResolvedValue({
      reference: "REF123",
      paymentUrl: "https://pay.example.com/REF123",
    });
  });

  it("membuat order, memanggil provider, dan mengembalikan payment url", async () => {
    mockSettings({
      "payment.provider": "duitku",
      "pricing.packPrice": "10000",
    });
    const result = await gatewayService.createGatewayCheckout("user-1", 2, {
      callbackBaseUrl: "https://api.example.com",
      returnUrl: "https://app.example.com",
    });

    expect(result.paymentUrl).toBe("https://pay.example.com/REF123");
    expect(result.order.reference).toBe("REF123");

    const createArgs = vi.mocked(db.order.create).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      userId: "user-1",
      method: "DUITKU",
      packs: 2,
      amount: 20000,
    });

    const chargeArgs = fakeProvider.createCharge.mock.calls[0][0];
    expect(chargeArgs.orderId).toBe("order-1");
    expect(chargeArgs.amount).toBe(20000);
    expect(chargeArgs.callbackUrl).toBe(
      "https://api.example.com/billing/webhook/duitku"
    );
    expect(vi.mocked(db.order.update).mock.calls[0][0].data).toEqual({
      reference: "REF123",
    });
  });

  it("melempar 503 saat tidak ada provider aktif", async () => {
    mockSettings({ "payment.provider": "" });
    await expect(
      gatewayService.createGatewayCheckout("user-1", 1, {
        callbackBaseUrl: "https://api.example.com",
        returnUrl: "https://app.example.com",
      })
    ).rejects.toMatchObject({ status: 503 });
    expect(db.order.create).not.toHaveBeenCalled();
  });

  it("melempar 503 saat provider aktif belum dikonfigurasi", async () => {
    mockSettings({ "payment.provider": "duitku" });
    fakeProvider.isConfigured.mockResolvedValue(false);
    await expect(
      gatewayService.createGatewayCheckout("user-1", 1, {
        callbackBaseUrl: "https://api.example.com",
        returnUrl: "https://app.example.com",
      })
    ).rejects.toMatchObject({ status: 503 });
    expect(db.order.create).not.toHaveBeenCalled();
  });
});

describe("gateway.service handleWebhook", () => {
  const request = { rawBody: "", body: {}, headers: {} };

  it("menyetel order menjadi paid saat outcome PAID", async () => {
    fakeProvider.parseWebhook.mockResolvedValue({
      orderId: "order-1",
      status: "PAID",
    });
    const result = await gatewayService.handleWebhook("duitku", request);
    expect(result).toEqual({ ok: true, status: "PAID", orderId: "order-1" });
    expect(vi.mocked(settleOrderPaid)).toHaveBeenCalledWith("order-1");
  });

  it("tidak menyetel saat outcome bukan PAID", async () => {
    fakeProvider.parseWebhook.mockResolvedValue({
      orderId: "order-1",
      status: "PENDING",
    });
    const result = await gatewayService.handleWebhook("duitku", request);
    expect(result.status).toBe("PENDING");
    expect(vi.mocked(settleOrderPaid)).not.toHaveBeenCalled();
  });

  it("melempar 400 untuk provider tidak dikenal", async () => {
    await expect(
      gatewayService.handleWebhook("midtrans", request)
    ).rejects.toMatchObject({ status: 400 });
  });
});
