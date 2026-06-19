import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { getHubSettings } from "@/services/hubSettings.service.js";
import * as settingsService from "@/services/settings.service.js";

vi.mock("@/services/hubSettings.service.js", () => ({
  getHubSettings: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  settingsService.invalidateSettingsCache();
  vi.mocked(getHubSettings).mockResolvedValue({});
});

describe("getSetting hub override", () => {
  it("prefers a non-empty hub value over the local DB", async () => {
    vi.mocked(getHubSettings).mockResolvedValue({ "smtp.host": "hub.example" });
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "smtp.host",
      value: "local.example",
      encrypted: false,
      updatedAt: new Date(),
    } as never);

    const value = await settingsService.getSetting("smtp.host");
    expect(value).toBe("hub.example");
    // hub wins without even touching the local table
    expect(db.setting.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to the local DB when the hub has no (or empty) value", async () => {
    vi.mocked(getHubSettings).mockResolvedValue({ "smtp.host": "" });
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      key: "smtp.host",
      value: "local.example",
      encrypted: false,
      updatedAt: new Date(),
    } as never);

    expect(await settingsService.getSetting("smtp.host")).toBe("local.example");
  });

  it("falls back to defaults when neither hub nor DB has the key", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null);
    // pricing.packPrice has a built-in default
    const value = await settingsService.getSetting("pricing.packPrice");
    expect(value).toBeTruthy();
  });
});
