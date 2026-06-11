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
    expect(await settingsService.getSetting("pricing.packPrice")).toBe("10000");
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
      value: "10000",
      masked: false,
    });
    expect(settings["anthropic.apiKey"]).toEqual({ value: "", masked: false });
  });
});

describe("settings.service pricing helpers", () => {
  it("mengembalikan angka harga paket dan kuota ai", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    expect(await settingsService.getPackPrice()).toBe(10000);
    expect(await settingsService.getAiPerPack()).toBe(3);
  });

  it("fallback ke default saat nilai tidak valid", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "pricing.packPrice",
      value: "bukan-angka",
      encrypted: false,
      updatedAt: new Date(),
    } as never);
    expect(await settingsService.getPackPrice()).toBe(10000);
  });
});
