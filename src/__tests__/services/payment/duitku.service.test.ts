import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as duitkuService from "@/services/payment/duitku.service.js";

const config = { merchantCode: "DM001", apiKey: "api-key-rahasia" };

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

describe("duitku.service signature", () => {
  it("membuat signature invoice md5 merchantCode+orderId+amount+apiKey", () => {
    const signature = duitkuService.createInvoiceSignature(
      config,
      "order-1",
      20000
    );
    expect(signature).toBe(md5("DM001order-120000api-key-rahasia"));
  });

  it("memverifikasi signature callback yang valid", () => {
    const signature = md5("DM00120000order-1api-key-rahasia");
    expect(
      duitkuService.verifyCallbackSignature(config, {
        amount: "20000",
        merchantOrderId: "order-1",
        signature,
      })
    ).toBe(true);
  });

  it("menolak signature callback yang salah", () => {
    expect(
      duitkuService.verifyCallbackSignature(config, {
        amount: "20000",
        merchantOrderId: "order-1",
        signature: md5("data-lain"),
      })
    ).toBe(false);
  });

  it("menolak signature dengan panjang berbeda tanpa melempar error", () => {
    expect(
      duitkuService.verifyCallbackSignature(config, {
        amount: "20000",
        merchantOrderId: "order-1",
        signature: "pendek",
      })
    ).toBe(false);
  });
});

describe("duitku.service getDuitkuConfig", () => {
  it("melempar 503 saat kredensial belum diisi admin", async () => {
    mockSettings({});
    await expect(duitkuService.getDuitkuConfig()).rejects.toMatchObject({
      status: 503,
    });
  });

  it("memakai base url sandbox atau production sesuai setting", async () => {
    mockSettings({ ...duitkuSettings, "duitku.env": "production" });
    const result = await duitkuService.getDuitkuConfig();
    expect(result.baseUrl).toContain("passport.duitku.com");
  });
});

describe("duitku.service createInvoice", () => {
  it("mengirim request bertanda tangan dan mengembalikan payment url", async () => {
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
    const result = await duitkuService.createInvoice({
      merchantOrderId: "order-1",
      amount: 20000,
      productDetails: "2 paket kredit",
      customerName: "Budi",
      email: "budi@instif.id",
      callbackUrl: "https://api.example.com/billing/callback/duitku",
      returnUrl: "https://example.com",
    });
    expect(result).toEqual({
      reference: "REF123",
      paymentUrl: "https://sandbox.duitku.com/pay/REF123",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry"
    );
    const body = JSON.parse((init as { body: string }).body);
    expect(body.signature).toBe(md5("DM001order-120000api-key-rahasia"));
    expect(body.paymentAmount).toBe(20000);
    vi.unstubAllGlobals();
  });

  it("melempar error saat duitku menolak request", async () => {
    mockSettings(duitkuSettings);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          statusCode: "01",
          statusMessage: "Invalid merchant",
        }),
      })
    );
    await expect(
      duitkuService.createInvoice({
        merchantOrderId: "order-1",
        amount: 20000,
        productDetails: "x",
        customerName: "Budi",
        email: "budi@instif.id",
        callbackUrl: "https://api.example.com/cb",
        returnUrl: "https://example.com",
      })
    ).rejects.toMatchObject({ status: 502 });
    vi.unstubAllGlobals();
  });
});

describe("duitku.service handleCallback", () => {
  const pendingOrder = {
    id: "order-1",
    userId: "user-1",
    method: "DUITKU",
    amount: 20000,
    packs: 2,
    status: "PENDING",
  };

  function validCallback() {
    return {
      merchantOrderId: "order-1",
      amount: "20000",
      signature: md5("DM00120000order-1api-key-rahasia"),
      resultCode: "00",
    };
  }

  it("menolak callback dengan signature tidak valid", async () => {
    mockSettings(duitkuSettings);
    await expect(
      duitkuService.handleCallback({
        ...validCallback(),
        signature: md5("palsu"),
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("menandai paid dan menambah kredit saat resultCode 00", async () => {
    mockSettings(duitkuSettings);
    vi.mocked(db.order.findUnique).mockResolvedValue(pendingOrder as never);
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.credit.upsert).mockResolvedValue({} as never);
    const result = await duitkuService.handleCallback(validCallback());
    expect(result).toEqual({ ok: true });
    expect(db.order.updateMany).toHaveBeenCalled();
    expect(db.credit.upsert).toHaveBeenCalled();
  });

  it("idempoten saat order sudah paid", async () => {
    mockSettings(duitkuSettings);
    vi.mocked(db.order.findUnique).mockResolvedValue({
      ...pendingOrder,
      status: "PAID",
    } as never);
    const result = await duitkuService.handleCallback(validCallback());
    expect(result).toEqual({ ok: true });
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.credit.upsert).not.toHaveBeenCalled();
  });

  it("mengabaikan resultCode selain 00 tanpa menambah kredit", async () => {
    mockSettings(duitkuSettings);
    const result = await duitkuService.handleCallback({
      ...validCallback(),
      signature: md5("DM00120000order-1api-key-rahasia"),
      resultCode: "02",
    });
    expect(result).toEqual({ ok: true });
    expect(db.order.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1" } })
    );
    expect(db.credit.upsert).not.toHaveBeenCalled();
  });
});
