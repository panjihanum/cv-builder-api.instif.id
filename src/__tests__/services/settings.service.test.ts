import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { encrypt, decrypt } from "@/lib/crypto.js";
import * as settingsService from "@/services/settings.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  settingsService.invalidateSettingsCache();
});

describe("settings.service setSettings", () => {
  it("mengenkripsi key sensitif sebelum disimpan", async () => {
    vi.mocked(db.setting.upsert).mockResolvedValue({} as never);
    await settingsService.setSettings({ "duitku.apiKey": "rahasia-api-key" });
    const args = vi.mocked(db.setting.upsert).mock.calls[0][0];
    expect(args.create.value).not.toBe("rahasia-api-key");
    expect(args.create.encrypted).toBe(true);
    expect(decrypt(args.create.value as string)).toBe("rahasia-api-key");
  });

  it("menyimpan key non-sensitif sebagai plaintext", async () => {
    vi.mocked(db.setting.upsert).mockResolvedValue({} as never);
    await settingsService.setSettings({ "pricing.packPrice": "15000" });
    const args = vi.mocked(db.setting.upsert).mock.calls[0][0];
    expect(args.create.value).toBe("15000");
    expect(args.create.encrypted).toBe(false);
  });
});

describe("settings.service getSetting", () => {
  it("mendekripsi nilai terenkripsi dari database", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "anthropic.apiKey",
      value: encrypt("sk-ant-rahasia"),
      encrypted: true,
      updatedAt: new Date(),
    } as never);
    const value = await settingsService.getSetting("anthropic.apiKey");
    expect(value).toBe("sk-ant-rahasia");
  });

  it("mengembalikan default saat setting belum diisi", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    expect(await settingsService.getSetting("pricing.packPrice")).toBe("13000");
    expect(await settingsService.getSetting("anthropic.model")).toBe(
      "claude-opus-4-8"
    );
  });

  it("mengembalikan null untuk key tanpa default", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    expect(await settingsService.getSetting("duitku.apiKey")).toBeNull();
  });

  it("memakai cache pada pemanggilan kedua", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "duitku.merchantCode",
      value: "DXXXX",
      encrypted: false,
      updatedAt: new Date(),
    } as never);
    await settingsService.getSetting("duitku.merchantCode");
    await settingsService.getSetting("duitku.merchantCode");
    expect(db.setting.findUnique).toHaveBeenCalledTimes(1);
  });

  it("membaca ulang dari database setelah setSettings", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "duitku.merchantCode",
      value: "LAMA",
      encrypted: false,
      updatedAt: new Date(),
    } as never);
    vi.mocked(db.setting.upsert).mockResolvedValue({} as never);
    await settingsService.getSetting("duitku.merchantCode");
    await settingsService.setSettings({ "duitku.merchantCode": "BARU" });
    await settingsService.getSetting("duitku.merchantCode");
    expect(db.setting.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("settings.service getRequiredSetting", () => {
  it("melempar 503 dengan pesan jelas saat setting wajib kosong", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    await expect(
      settingsService.getRequiredSetting(
        "duitku.apiKey",
        "Duitku belum dikonfigurasi"
      )
    ).rejects.toMatchObject({
      status: 503,
      message: "Duitku belum dikonfigurasi",
    });
  });
});

describe("settings.service getAllSettingsMasked", () => {
  it("memask key sensitif dan menampilkan key biasa apa adanya", async () => {
    vi.mocked(db.setting.findMany).mockResolvedValue([
      {
        id: "s1",
        key: "duitku.apiKey",
        value: encrypt("apikey-duitku-9876"),
        encrypted: true,
        updatedAt: new Date(),
      },
      {
        id: "s2",
        key: "duitku.merchantCode",
        value: "D12345",
        encrypted: false,
        updatedAt: new Date(),
      },
    ] as never);
    const settings = await settingsService.getAllSettingsMasked();
    expect(settings["duitku.apiKey"]).toEqual({
      value: "••••9876",
      masked: true,
    });
    expect(settings["duitku.merchantCode"]).toEqual({
      value: "D12345",
      masked: false,
    });
    expect(settings["pricing.packPrice"]).toEqual({
      value: "13000",
      masked: false,
    });
    expect(settings["anthropic.apiKey"]).toEqual({ value: "", masked: false });
  });
});

describe("settings.service payment gateway keys", () => {
  it("mengenkripsi kredensial xendit yang sensitif", async () => {
    vi.mocked(db.setting.upsert).mockResolvedValue({} as never);
    await settingsService.setSettings({
      "xendit.apiKey": "xnd_secret",
      "xendit.callbackToken": "cb-token",
    });
    for (const call of vi.mocked(db.setting.upsert).mock.calls) {
      const args = call[0];
      expect(args.create.encrypted).toBe(true);
      expect(args.create.value).not.toBe("xnd_secret");
    }
  });

  it("menyimpan payment.provider sebagai plaintext biasa", async () => {
    vi.mocked(db.setting.upsert).mockResolvedValue({} as never);
    await settingsService.setSettings({ "payment.provider": "xendit" });
    const args = vi.mocked(db.setting.upsert).mock.calls[0][0];
    expect(args.create.value).toBe("xendit");
    expect(args.create.encrypted).toBe(false);
  });

  it("getAllSettingsMasked menampilkan default provider kosong dan memask xendit", async () => {
    vi.mocked(db.setting.findMany).mockResolvedValue([
      {
        id: "s1",
        key: "xendit.apiKey",
        value: encrypt("xnd_secret_1234"),
        encrypted: true,
        updatedAt: new Date(),
      },
    ] as never);
    const settings = await settingsService.getAllSettingsMasked();
    expect(settings["payment.provider"]).toEqual({ value: "", masked: false });
    expect(settings["xendit.apiKey"]).toEqual({
      value: "••••1234",
      masked: true,
    });
  });
});

describe("settings.service pricing helpers", () => {
  it("mengembalikan angka harga paket dan kredit per pack", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    expect(await settingsService.getPackPrice()).toBe(13000);
    expect(await settingsService.getCreditsPerPack()).toBe(15);
  });

  it("fallback ke default saat nilai tidak valid", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "pricing.packPrice",
      value: "bukan-angka",
      encrypted: false,
      updatedAt: new Date(),
    } as never);
    expect(await settingsService.getPackPrice()).toBe(13000);
  });
});

describe("settings.service biaya kredit fleksibel", () => {
  it("getCreditCosts mengembalikan default saat DB kosong", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    const costs = await settingsService.getCreditCosts();
    expect(costs.templateTier).toEqual({
      free: 0,
      basic: 4,
      standard: 6,
      premium: 8,
      elite: 10,
      flagship: 12,
    });
    expect(costs.aiParse).toBe(2);
    expect(costs.aiSectionImprove).toBe(1);
    expect(costs.aiPolish).toBe(5);
  });

  it("getPricingConfig menyusun seluruh harga default", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    const pricing = await settingsService.getPricingConfig();
    expect(pricing).toMatchObject({
      packPrice: 13000,
      originalPackPrice: 25000,
      creditsPerPack: 15,
      maxPacksPerOrder: 10,
    });
    expect(pricing.costs.templateTier.flagship).toBe(12);
  });

  it("memakai nilai admin dari DB dan mengizinkan biaya 0", async () => {
    vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
      where: { key: string };
    }) => {
      const overrides: Record<string, string> = {
        "pricing.cost.template.premium": "20",
        "pricing.cost.aiPolish": "0",
      };
      const value = overrides[args.where.key];
      return value === undefined
        ? null
        : {
            id: "x",
            key: args.where.key,
            value,
            encrypted: false,
            updatedAt: new Date(),
          };
    }) as never);
    const costs = await settingsService.getCreditCosts();
    expect(costs.templateTier.premium).toBe(20);
    expect(costs.aiPolish).toBe(0);
    expect(costs.templateTier.basic).toBe(4);
  });
});
