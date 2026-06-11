import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rateLimit.js";

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lib/rateLimit", () => {
  it("mengizinkan hingga batas maksimal dalam satu window", () => {
    expect(checkRateLimit("key", 3, 60_000)).toBe(true);
    expect(checkRateLimit("key", 3, 60_000)).toBe(true);
    expect(checkRateLimit("key", 3, 60_000)).toBe(true);
    expect(checkRateLimit("key", 3, 60_000)).toBe(false);
  });

  it("memisahkan limit per key", () => {
    expect(checkRateLimit("a", 1, 60_000)).toBe(true);
    expect(checkRateLimit("a", 1, 60_000)).toBe(false);
    expect(checkRateLimit("b", 1, 60_000)).toBe(true);
  });

  it("mengizinkan lagi setelah window berlalu", () => {
    expect(checkRateLimit("key", 1, 60_000)).toBe(true);
    expect(checkRateLimit("key", 1, 60_000)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit("key", 1, 60_000)).toBe(true);
  });
});
