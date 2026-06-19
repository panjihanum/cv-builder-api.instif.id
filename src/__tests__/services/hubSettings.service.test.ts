import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/env.js", () => ({
  env: { SSO_SECRET: "shared-secret", INSTIF_HUB_URL: "https://hub.test" },
}));

import {
  getHubSettings,
  isHubSettingsConfigured,
  clearHubSettingsCache,
} from "@/services/hubSettings.service.js";

function expectedSignature(): string {
  const body = JSON.stringify({ app: "cv-builder" });
  return crypto
    .createHmac("sha256", "shared-secret")
    .update(body)
    .digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  clearHubSettingsCache();
});

describe("isHubSettingsConfigured", () => {
  it("true when SSO_SECRET is set", () => {
    expect(isHubSettingsConfigured()).toBe(true);
  });
});

describe("getHubSettings", () => {
  it("POSTs the signed { app } payload to the hub and returns settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { settings: { "smtp.host": "smtp.gmail.com" } },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getHubSettings();
    expect(result).toEqual({ "smtp.host": "smtp.gmail.com" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hub.test/api/partner/settings");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ app: "cv-builder" }));
    expect(init.headers["x-partner-signature"]).toBe(expectedSignature());
  });

  it("caches results — a second call within TTL does not re-fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { settings: { k: "v" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getHubSettings();
    await getHubSettings();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("force=true bypasses the cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { settings: { k: "v" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getHubSettings();
    await getHubSettings(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns {} on hub failure with no prior cache (safe fallback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );
    expect(await getHubSettings()).toEqual({});
  });

  it("falls back to the last good cache on a later failure", async () => {
    const ok = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { settings: { k: "good" } } }),
    });
    vi.stubGlobal("fetch", ok);
    await getHubSettings();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await getHubSettings(true)).toEqual({ k: "good" });
  });
});
