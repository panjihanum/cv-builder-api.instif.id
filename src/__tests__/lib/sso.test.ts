import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  SSO_AUDIENCES,
  SSO_MAX_CLOCK_SKEW_MS,
  SSO_TOKEN_TTL_MS,
  SSO_TOKEN_VERSION,
  SsoReplayGuard,
  isSsoAudience,
  signSsoToken,
  verifySsoToken,
  type SsoAudience,
  type SsoClaims,
} from "@/lib/sso.js";

const SECRET = "test-sso-secret-32chars-at-minimum";

function decodeClaims(token: string): SsoClaims {
  const [payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/** Re-sign arbitrary claims so tests can forge *validly signed* nonsense. */
function forge(claims: Record<string, unknown>, secret = SECRET): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url"
  );
  const sig = createHmac("sha256", secret)
    .update("instif-sso-v2:" + payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

function admin(audience: SsoAudience = "news") {
  return {
    userId: "user-1",
    email: "admin@instif.id",
    role: "ADMIN",
    audience,
  };
}

beforeEach(() => {
  process.env.SSO_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.SSO_SECRET;
});

describe("signSsoToken", () => {
  it("mints a payload.signature token carrying the full v2 claim set", () => {
    const token = signSsoToken(admin("news"));

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
    const claims = decodeClaims(token);
    expect(claims).toMatchObject({
      v: SSO_TOKEN_VERSION,
      sub: "user-1",
      email: "admin@instif.id",
      role: "ADMIN",
      aud: "news",
    });
    expect(claims.jti).toMatch(/^[0-9a-f]{32}$/);
    expect(claims.exp - claims.iat).toBe(SSO_TOKEN_TTL_MS);
  });

  it("defaults a missing email to null rather than omitting it", () => {
    expect(
      decodeClaims(signSsoToken({ ...admin(), email: undefined })).email
    ).toBeNull();
  });

  it("gives every token a distinct jti", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => decodeClaims(signSsoToken(admin())).jti)
    );
    expect(ids.size).toBe(50);
  });

  it("throws when SSO_SECRET is missing", () => {
    delete process.env.SSO_SECRET;
    expect(() => signSsoToken(admin())).toThrow("SSO_SECRET");
  });

  it("throws when SSO_SECRET is too weak to be worth signing with", () => {
    process.env.SSO_SECRET = "short";
    expect(() => signSsoToken(admin())).toThrow("SSO_SECRET");
  });

  it("refuses to issue a token for a non-admin", () => {
    expect(() => signSsoToken({ ...admin(), role: "USER" })).toThrow("ADMIN");
  });

  it("refuses an unregistered audience", () => {
    expect(() =>
      signSsoToken({ ...admin(), audience: "evil" as SsoAudience })
    ).toThrow("audience");
  });

  it("refuses a caller-supplied ttl longer than the protocol maximum", () => {
    expect(() =>
      signSsoToken(admin(), { ttlMs: SSO_TOKEN_TTL_MS + 1 })
    ).toThrow("ttl");
    expect(() => signSsoToken(admin(), { ttlMs: 0 })).toThrow("ttl");
  });
});

describe("verifySsoToken", () => {
  it("accepts a freshly signed token for its own audience", () => {
    const result = verifySsoToken(signSsoToken(admin("crm")), {
      audience: "crm",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims.sub).toBe("user-1");
    expect(result.claims.email).toBe("admin@instif.id");
    expect(result.claims.aud).toBe("crm");
  });

  it("round-trips for every registered audience", () => {
    for (const audience of SSO_AUDIENCES) {
      expect(
        verifySsoToken(signSsoToken(admin(audience)), { audience }).ok
      ).toBe(true);
    }
  });

  // The whole point of `aud`: one shared secret, but a token minted for one app
  // must be useless at every other app.
  it("rejects a token minted for a different app", () => {
    const forNews = signSsoToken(admin("news"));

    for (const audience of SSO_AUDIENCES) {
      const result = verifySsoToken(forNews, { audience });
      if (audience === "news") {
        expect(result.ok).toBe(true);
      } else {
        expect(result).toEqual({ ok: false, reason: "wrong_audience" });
      }
    }
  });

  it("rejects an unregistered audience even with a valid signature", () => {
    expect(
      verifySsoToken(signSsoToken(admin()), {
        audience: "tools" as SsoAudience,
      })
    ).toEqual({ ok: false, reason: "wrong_audience" });
  });

  it("reports not_configured when the secret is missing or weak", () => {
    const token = signSsoToken(admin());

    delete process.env.SSO_SECRET;
    expect(verifySsoToken(token, { audience: "news" })).toEqual({
      ok: false,
      reason: "not_configured",
    });

    process.env.SSO_SECRET = "tooshort";
    expect(verifySsoToken(token, { audience: "news" })).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSsoToken(admin(), {
      secret: "a-completely-other-secret",
    });
    expect(verifySsoToken(token, { audience: "news" })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects a tampered payload", () => {
    const token = signSsoToken(admin());
    const [, sig] = token.split(".");
    const swapped = Buffer.from(
      JSON.stringify({ ...decodeClaims(token), aud: "crm" }),
      "utf8"
    ).toString("base64url");

    expect(verifySsoToken(`${swapped}.${sig}`, { audience: "crm" })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects a tampered signature", () => {
    const token = signSsoToken(admin());
    const flipped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySsoToken(flipped, { audience: "news" })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it.each([
    ["empty string", ""],
    ["no separator", "abcdef"],
    ["empty payload", ".0".padEnd(66, "0")],
    ["non-hex signature", "abc.zzzz"],
    ["short signature", "abc.dead"],
    ["payload with illegal chars", "a b c.".padEnd(70, "0")],
    ["not a string", 42],
    ["null", null],
    ["undefined", undefined],
  ])("rejects a malformed token (%s)", (_label, token) => {
    expect(verifySsoToken(token, { audience: "news" })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a validly signed token whose payload is not JSON", () => {
    const payload = Buffer.from("not-json", "utf8").toString("base64url");
    const sig = createHmac("sha256", SECRET)
      .update("instif-sso-v2:" + payload)
      .digest("hex");

    expect(verifySsoToken(`${payload}.${sig}`, { audience: "news" })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects an older token format", () => {
    const now = Date.now();
    const token = forge({
      v: 1,
      sub: "user-1",
      role: "ADMIN",
      aud: "news",
      jti: "x",
      iat: now,
      exp: now + 1000,
    });

    expect(verifySsoToken(token, { audience: "news" })).toEqual({
      ok: false,
      reason: "unsupported_version",
    });
  });

  it("rejects a validly signed non-admin token", () => {
    const now = Date.now();
    const token = forge({
      v: SSO_TOKEN_VERSION,
      sub: "user-1",
      email: null,
      role: "USER",
      aud: "news",
      jti: "abc",
      iat: now,
      exp: now + SSO_TOKEN_TTL_MS,
    });

    expect(verifySsoToken(token, { audience: "news" })).toEqual({
      ok: false,
      reason: "not_admin",
    });
  });

  it.each([
    ["missing sub", { sub: "" }],
    ["missing jti", { jti: "" }],
    ["non-numeric iat", { iat: "soon" }],
    ["non-numeric exp", { exp: null }],
  ])("rejects claims with %s", (_label, override) => {
    const now = Date.now();
    const token = forge({
      v: SSO_TOKEN_VERSION,
      sub: "user-1",
      email: null,
      role: "ADMIN",
      aud: "news",
      jti: "abc",
      iat: now,
      exp: now + SSO_TOKEN_TTL_MS,
      ...override,
    });

    expect(verifySsoToken(token, { audience: "news" })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a self-extended lifetime even when the token looks fresh", () => {
    const now = Date.now();
    const token = forge({
      v: SSO_TOKEN_VERSION,
      sub: "user-1",
      email: null,
      role: "ADMIN",
      aud: "news",
      jti: "abc",
      iat: now,
      exp: now + 24 * 60 * 60 * 1000,
    });

    expect(verifySsoToken(token, { audience: "news", now })).toEqual({
      ok: false,
      reason: "ttl_too_long",
    });
  });

  describe("expiry", () => {
    const issuedAt = 1_700_000_000_000;
    const token = () => signSsoToken(admin(), { now: issuedAt });

    it("accepts a token right up to its expiry", () => {
      expect(
        verifySsoToken(token(), {
          audience: "news",
          now: issuedAt + SSO_TOKEN_TTL_MS,
        }).ok
      ).toBe(true);
    });

    it("still accepts within the clock-skew grace period", () => {
      expect(
        verifySsoToken(token(), {
          audience: "news",
          now: issuedAt + SSO_TOKEN_TTL_MS + SSO_MAX_CLOCK_SKEW_MS,
        }).ok
      ).toBe(true);
    });

    it("rejects once past expiry plus skew", () => {
      expect(
        verifySsoToken(token(), {
          audience: "news",
          now: issuedAt + SSO_TOKEN_TTL_MS + SSO_MAX_CLOCK_SKEW_MS + 1,
        })
      ).toEqual({ ok: false, reason: "expired" });
    });

    it("rejects a token from further in the future than clock skew allows", () => {
      expect(
        verifySsoToken(token(), {
          audience: "news",
          now: issuedAt - SSO_MAX_CLOCK_SKEW_MS - 1,
        })
      ).toEqual({ ok: false, reason: "not_yet_valid" });
    });

    it("is not valid for the old five-minute window", () => {
      expect(
        verifySsoToken(token(), {
          audience: "news",
          now: issuedAt + 5 * 60 * 1000,
        })
      ).toEqual({ ok: false, reason: "expired" });
    });
  });

  describe("replay", () => {
    it("accepts the first redemption and rejects every later one", () => {
      const guard = new SsoReplayGuard();
      const token = signSsoToken(admin());

      expect(
        verifySsoToken(token, { audience: "news", replayGuard: guard }).ok
      ).toBe(true);
      expect(
        verifySsoToken(token, { audience: "news", replayGuard: guard })
      ).toEqual({ ok: false, reason: "replayed" });
      expect(
        verifySsoToken(token, { audience: "news", replayGuard: guard })
      ).toEqual({ ok: false, reason: "replayed" });
    });

    it("does not confuse two tokens for the same admin", () => {
      const guard = new SsoReplayGuard();
      expect(
        verifySsoToken(signSsoToken(admin()), {
          audience: "news",
          replayGuard: guard,
        }).ok
      ).toBe(true);
      expect(
        verifySsoToken(signSsoToken(admin()), {
          audience: "news",
          replayGuard: guard,
        }).ok
      ).toBe(true);
    });

    // An attacker who could burn a jti with a junk token could lock the admin
    // out, so nothing may reach the guard until it has fully verified.
    it("does not consume a jti for a token that fails an earlier check", () => {
      const guard = new SsoReplayGuard();
      const token = signSsoToken(admin("news"));

      expect(
        verifySsoToken(token, { audience: "crm", replayGuard: guard })
      ).toEqual({ ok: false, reason: "wrong_audience" });
      expect(guard.size).toBe(0);

      expect(
        verifySsoToken(token, { audience: "news", replayGuard: guard }).ok
      ).toBe(true);
    });

    it("verifies without a guard, leaving the token replayable", () => {
      const token = signSsoToken(admin());
      expect(verifySsoToken(token, { audience: "news" }).ok).toBe(true);
      expect(verifySsoToken(token, { audience: "news" }).ok).toBe(true);
    });
  });
});

describe("SsoReplayGuard", () => {
  it("consumes an id exactly once", () => {
    const guard = new SsoReplayGuard();
    expect(guard.consume("a", 2_000, 1_000)).toBe(true);
    expect(guard.consume("a", 2_000, 1_000)).toBe(false);
  });

  it("tracks ids independently", () => {
    const guard = new SsoReplayGuard();
    expect(guard.consume("a", 2_000, 1_000)).toBe(true);
    expect(guard.consume("b", 2_000, 1_000)).toBe(true);
    expect(guard.size).toBe(2);
  });

  // Entries must not accumulate: the guard lives for the life of the process.
  it("drops entries once the token they guard has expired", () => {
    const guard = new SsoReplayGuard();
    guard.consume("a", 2_000, 1_000);
    expect(guard.size).toBe(1);

    guard.consume("b", 9_000, 2_001);
    expect(guard.size).toBe(1);
  });

  it("stays bounded across many short-lived tokens", () => {
    const guard = new SsoReplayGuard();
    for (let i = 0; i < 1_000; i++) {
      guard.consume(`jti-${i}`, i * 10 + 5, i * 10);
    }
    expect(guard.size).toBeLessThanOrEqual(2);
  });

  it("clears on demand", () => {
    const guard = new SsoReplayGuard();
    guard.consume("a", Date.now() + 60_000);
    guard.clear();
    expect(guard.size).toBe(0);
  });
});

describe("isSsoAudience", () => {
  it("accepts every registered audience", () => {
    for (const audience of SSO_AUDIENCES) {
      expect(isSsoAudience(audience)).toBe(true);
    }
  });

  it.each([["tools"], [""], [null], [undefined], [1], [{}]])(
    "rejects %p",
    (value) => {
      expect(isSsoAudience(value)).toBe(false);
    }
  );
});
