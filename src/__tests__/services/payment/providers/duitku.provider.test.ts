import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import { duitkuProvider } from "@/services/payment/providers/duitku.js";

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

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

const duitkuSettings = {
  "duitku.merchantCode": "DM001",
  "duitku.apiKey": "api-key-rahasia",
  "duitku.env": "sandbox",
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("duitku provider isConfigured", () => {
  it("true saat merchantCode dan apiKey ada", async () => {
    mockSettings(duitkuSettings);
    expect(await duitkuProvider.isConfigured()).toBe(true);
  });

  it("false saat apiKey kosong", async () => {
    mockSettings({ "duitku.merchantCode": "DM001" });
    expect(await duitkuProvider.isConfigured()).toBe(false);
  });
});

describe("duitku provider createCharge", () => {
  it("memanggil inquiry Duitku dan meneruskan payment url", async () => {
    mockSettings(duitkuSettings);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        statusCode: "00",
        statusMessage: "SUCCESS",
        reference: "REF123",
        paymentUrl: "https://sandbox.duitku.com/pay/REF123",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await duitkuProvider.createCharge({
      orderId: "order-1",
      amount: 20000,
      packs: 2,
      customerName: "Budi",
      email: "budi@instif.id",
      productDetails: "2 paket kredit",
      callbackUrl: "https://api.example.com/billing/webhook/duitku",
      returnUrl: "https://app.example.com",
    });
    expect(result).toEqual({
      reference: "REF123",
      paymentUrl: "https://sandbox.duitku.com/pay/REF123",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.merchantOrderId).toBe("order-1");
    vi.unstubAllGlobals();
  });
});

describe("duitku provider parseWebhook", () => {
  function callback(resultCode = "00") {
    const body = {
      merchantOrderId: "order-1",
      amount: "20000",
      signature: md5("DM00120000order-1api-key-rahasia"),
      resultCode,
    };
    return { rawBody: new URLSearchParams(body).toString(), body, headers: {} };
  }

  it("menolak signature tidak valid dengan 400", async () => {
    mockSettings(duitkuSettings);
    const bad = callback();
    bad.body.signature = md5("palsu");
    await expect(duitkuProvider.parseWebhook(bad)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("melempar 400 saat merchantOrderId tidak ada", async () => {
    mockSettings(duitkuSettings);
    await expect(
      duitkuProvider.parseWebhook({ rawBody: "", body: {}, headers: {} })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("mengembalikan PAID saat resultCode 00 dan signature valid", async () => {
    mockSettings(duitkuSettings);
    const outcome = await duitkuProvider.parseWebhook(callback("00"));
    expect(outcome).toEqual({ orderId: "order-1", status: "PAID" });
  });

  it("mengembalikan FAILED saat resultCode selain 00", async () => {
    mockSettings(duitkuSettings);
    const outcome = await duitkuProvider.parseWebhook(callback("02"));
    expect(outcome).toEqual({ orderId: "order-1", status: "FAILED" });
  });
});
