import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSmtpConfig,
  isEmailConfigured,
  verifySmtpConnection,
  appBaseUrl,
  apiBaseUrl,
} from "@/lib/email.js";
import { getSetting } from "@/services/settings.service.js";

vi.mock("@/services/settings.service.js", () => ({
  getSetting: vi.fn(),
}));

function mockSettings(values: Record<string, string | null>) {
  vi.mocked(getSetting).mockImplementation(async (key: string) =>
    key in values ? values[key] : null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSmtpConfig", () => {
  it("isConfigured=false saat host/user/pass kosong", async () => {
    mockSettings({});
    const cfg = await getSmtpConfig();
    expect(cfg.isConfigured).toBe(false);
    expect(cfg.port).toBe(587); // default
    expect(cfg.secure).toBe(false);
  });

  it("merakit konfigurasi lengkap dan isConfigured=true", async () => {
    mockSettings({
      "smtp.host": "smtp.gmail.com",
      "smtp.port": "465",
      "smtp.secure": "true",
      "smtp.user": "akun@gmail.com",
      "smtp.pass": "secret",
      "smtp.fromEmail": "no-reply@instif.id",
      "smtp.fromName": "Instif CV",
    });
    const cfg = await getSmtpConfig();
    expect(cfg).toMatchObject({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "akun@gmail.com",
      pass: "secret",
      fromEmail: "no-reply@instif.id",
      fromName: "Instif CV",
      isConfigured: true,
    });
  });

  it("port jatuh ke 587 bila nilai tidak valid", async () => {
    mockSettings({ "smtp.port": "abc" });
    expect((await getSmtpConfig()).port).toBe(587);
  });
});

describe("isEmailConfigured", () => {
  it("true hanya bila host, user, dan pass ada", async () => {
    mockSettings({ "smtp.host": "h", "smtp.user": "u" });
    expect(await isEmailConfigured()).toBe(false);
    mockSettings({ "smtp.host": "h", "smtp.user": "u", "smtp.pass": "p" });
    expect(await isEmailConfigured()).toBe(true);
  });
});

describe("verifySmtpConnection", () => {
  it("gagal cepat tanpa koneksi saat SMTP belum dikonfigurasi", async () => {
    mockSettings({});
    const result = await verifySmtpConnection();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/belum dikonfigurasi/i);
  });
});

describe("url helpers", () => {
  it("appBaseUrl & apiBaseUrl mengembalikan origin tanpa trailing slash", () => {
    expect(appBaseUrl()).not.toMatch(/\/$/);
    expect(apiBaseUrl()).not.toMatch(/\/$/);
    expect(apiBaseUrl()).toMatch(/^https?:\/\//);
  });
});
