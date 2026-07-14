import crypto from "node:crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";

vi.mock("@/lib/env.js", () => ({
  env: { SSO_SECRET: "shared-secret", INSTIF_HUB_URL: "https://hub.test" },
}));
vi.mock("@/services/settings.service.js", () => ({
  getPackPrice: vi.fn(),
}));
vi.mock("@/services/credit.service.js", () => ({
  settleOrderPaid: vi.fn(),
}));
vi.mock("@/services/paymentNotification.service.js", () => ({
  notifyGatewayPaid: vi.fn(),
}));

import { getPackPrice } from "@/services/settings.service.js";
import { settleOrderPaid } from "@/services/credit.service.js";
import * as hubService from "@/services/payment/hub.service.js";

function sign(body: string) {
  return crypto
    .createHmac("sha256", "shared-secret")
    .update(body)
    .digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hub.service signatures", () => {
  it("is configured when the shared secret is present", () => {
    expect(hubService.isHubConfigured()).toBe(true);
  });

  it("verifies a correctly-signed callback and rejects tampering", () => {
    const body = JSON.stringify({ externalRef: "o1", status: "PAID" });
    expect(hubService.verifyHubSignature(body, sign(body))).toBe(true);
    expect(hubService.verifyHubSignature(body, "deadbeef")).toBe(false);
    expect(
      hubService.verifyHubSignature(
        JSON.stringify({ externalRef: "o1", status: "FAILED" }),
        sign(body)
      )
    ).toBe(false);
  });
});

describe("hub.service createHubCheckout", () => {
  beforeEach(() => {
    vi.mocked(getPackPrice).mockResolvedValue(10000);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      name: "Budi",
      email: "budi@instif.id",
      phone: "0812345678",
    } as never);
    vi.mocked(db.order.create).mockResolvedValue({
      id: "order-1",
      method: "HUB",
      amount: 20000,
      packs: 2,
      status: "PENDING",
    } as never);
    vi.mocked(db.order.update).mockResolvedValue({
      id: "order-1",
      method: "HUB",
      amount: 20000,
      packs: 2,
      status: "PENDING",
      reference: "REF123",
    } as never);
  });

  it("creates an order, calls the hub (signed), and returns the payment url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          paymentUrl: "https://pay.instif.id/REF123",
          reference: "REF123",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await hubService.createHubCheckout("user-1", 2, {
      callbackBaseUrl: "https://api.example.com",
      returnUrl: "https://app.example.com",
    });

    expect(result.paymentUrl).toBe("https://pay.instif.id/REF123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hub.test/api/partner/checkout");
    const sentBody = init.body as string;
    const payload = JSON.parse(sentBody);
    expect(payload).toMatchObject({
      app: "cv-builder",
      externalRef: "order-1",
      amount: 20000,
      email: "budi@instif.id",
      phone: "0812345678",
      callbackUrl: "https://api.example.com/billing/hub-callback",
    });
    // signed with the shared secret over the exact raw body
    expect(init.headers["x-partner-signature"]).toBe(sign(sentBody));
    // reference persisted on the order
    expect(vi.mocked(db.order.update).mock.calls[0][0].data).toEqual({
      reference: "REF123",
    });
  });

  it("throws 503 with the hub's message when the hub rejects the checkout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Gateway down" }),
      })
    );
    await expect(
      hubService.createHubCheckout("user-1", 1, {
        callbackBaseUrl: "https://api.example.com",
        returnUrl: "https://app.example.com",
      })
    ).rejects.toMatchObject({ status: 503, message: "Gateway down" });
  });

  it("sends an empty email for phone-OTP accounts and surfaces the hub status when the body is not JSON", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      name: "Budi",
      email: null,
      phone: "0812345678",
    } as never);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      hubService.createHubCheckout("user-1", 1, {
        callbackBaseUrl: "https://api.example.com",
        returnUrl: "https://app.example.com",
      })
    ).rejects.toMatchObject({
      status: 503,
      message: "Gagal membuat pembayaran di gateway instif.id (HTTP 502)",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toMatchObject({
      email: "",
      phone: "0812345678",
    });
  });
});

describe("hub.service settleHubOrder", () => {
  it("credits the buyer via settleOrderPaid", async () => {
    vi.mocked(settleOrderPaid).mockResolvedValue({ alreadyPaid: false });
    await hubService.settleHubOrder("order-1");
    expect(vi.mocked(settleOrderPaid)).toHaveBeenCalledWith("order-1");
  });
});
