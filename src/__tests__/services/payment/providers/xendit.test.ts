import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import {
  getXenditConfig,
  mapInvoiceStatus,
  verifyCallbackToken,
  xenditProvider,
} from "@/services/payment/providers/xendit.js";

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

const xenditSettings = {
  "xendit.apiKey": "xnd_secret_abc",
  "xendit.callbackToken": "callback-token-123",
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("xendit verifyCallbackToken", () => {
  it("menerima token yang sama persis", () => {
    expect(verifyCallbackToken("token-123", "token-123")).toBe(true);
  });

  it("menolak token berbeda", () => {
    expect(verifyCallbackToken("token-123", "token-salah")).toBe(false);
  });

  it("menolak token dengan panjang berbeda tanpa melempar error", () => {
    expect(verifyCallbackToken("token-123", "x")).toBe(false);
  });
});

describe("xendit mapInvoiceStatus", () => {
  it("memetakan PAID dan SETTLED ke PAID", () => {
    expect(mapInvoiceStatus("PAID")).toBe("PAID");
    expect(mapInvoiceStatus("settled")).toBe("PAID");
  });

  it("memetakan EXPIRED/FAILED ke FAILED", () => {
    expect(mapInvoiceStatus("EXPIRED")).toBe("FAILED");
    expect(mapInvoiceStatus("FAILED")).toBe("FAILED");
  });

  it("status lain dianggap PENDING", () => {
    expect(mapInvoiceStatus("PENDING")).toBe("PENDING");
  });
});

describe("xendit getXenditConfig", () => {
  it("melempar 503 saat kredensial belum diisi", async () => {
    mockSettings({});
    await expect(getXenditConfig()).rejects.toMatchObject({ status: 503 });
  });

  it("mengembalikan apiKey dan callbackToken", async () => {
    mockSettings(xenditSettings);
    await expect(getXenditConfig()).resolves.toEqual({
      apiKey: "xnd_secret_abc",
      callbackToken: "callback-token-123",
    });
  });
});

describe("xendit isConfigured", () => {
  it("true saat kedua kredensial ada", async () => {
    mockSettings(xenditSettings);
    expect(await xenditProvider.isConfigured()).toBe(true);
  });

  it("false saat callbackToken kosong", async () => {
    mockSettings({ "xendit.apiKey": "xnd_secret_abc" });
    expect(await xenditProvider.isConfigured()).toBe(false);
  });
});

describe("xendit createCharge", () => {
  it("membuat invoice dengan basic auth dan mengembalikan payment url", async () => {
    mockSettings(xenditSettings);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "inv_123",
        invoice_url: "https://checkout.xendit.co/web/inv_123",
        status: "PENDING",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await xenditProvider.createCharge({
      orderId: "order-1",
      amount: 20000,
      packs: 2,
      customerName: "Budi",
      email: "budi@instif.id",
      productDetails: "2 paket kredit",
      callbackUrl: "https://api.example.com/billing/webhook/xendit",
      returnUrl: "https://app.example.com",
    });
    expect(result).toEqual({
      reference: "inv_123",
      paymentUrl: "https://checkout.xendit.co/web/inv_123",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.xendit.co/v2/invoices");
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("xnd_secret_abc:").toString("base64")}`
    );
    const body = JSON.parse((init as { body: string }).body);
    expect(body.external_id).toBe("order-1");
    expect(body.amount).toBe(20000);
    vi.unstubAllGlobals();
  });

  it("melempar 502 saat Xendit menolak request", async () => {
    mockSettings(xenditSettings);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    );
    await expect(
      xenditProvider.createCharge({
        orderId: "order-1",
        amount: 20000,
        packs: 2,
        customerName: "Budi",
        email: "budi@instif.id",
        productDetails: "x",
        callbackUrl: "https://api.example.com/cb",
        returnUrl: "https://app.example.com",
      })
    ).rejects.toMatchObject({ status: 502 });
    vi.unstubAllGlobals();
  });

  it("melempar 502 saat respons tanpa invoice_url", async () => {
    mockSettings(xenditSettings);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: "inv_1" }) })
    );
    await expect(
      xenditProvider.createCharge({
        orderId: "order-1",
        amount: 20000,
        packs: 2,
        customerName: "Budi",
        email: "budi@instif.id",
        productDetails: "x",
        callbackUrl: "https://api.example.com/cb",
        returnUrl: "https://app.example.com",
      })
    ).rejects.toMatchObject({ status: 502 });
    vi.unstubAllGlobals();
  });
});

describe("xendit parseWebhook", () => {
  function webhook(
    body: Record<string, unknown>,
    token = "callback-token-123"
  ) {
    return {
      rawBody: JSON.stringify(body),
      body,
      headers: { "x-callback-token": token },
    };
  }

  it("menolak token callback yang salah dengan 401", async () => {
    mockSettings(xenditSettings);
    await expect(
      xenditProvider.parseWebhook(
        webhook({ external_id: "order-1", status: "PAID" }, "token-palsu")
      )
    ).rejects.toMatchObject({ status: 401 });
  });

  it("melempar 400 saat external_id tidak ada", async () => {
    mockSettings(xenditSettings);
    await expect(
      xenditProvider.parseWebhook(webhook({ status: "PAID" }))
    ).rejects.toMatchObject({ status: 400 });
  });

  it("mengembalikan PAID untuk invoice yang dibayar", async () => {
    mockSettings(xenditSettings);
    const outcome = await xenditProvider.parseWebhook(
      webhook({ external_id: "order-1", status: "PAID" })
    );
    expect(outcome).toEqual({ orderId: "order-1", status: "PAID" });
  });

  it("mengembalikan PENDING untuk status non-final", async () => {
    mockSettings(xenditSettings);
    const outcome = await xenditProvider.parseWebhook(
      webhook({ external_id: "order-1", status: "PENDING" })
    );
    expect(outcome).toEqual({ orderId: "order-1", status: "PENDING" });
  });
});
