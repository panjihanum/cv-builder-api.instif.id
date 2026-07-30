import { describe, it, expect, beforeEach, vi } from "vitest";

const SECRET = "test-sso-secret-32chars-at-minimum";

const mockEnv = vi.hoisted(() => ({
  env: {
    SSO_SECRET: "test-sso-secret-32chars-at-minimum",
    INSTIF_HUB_URL: "https://hub.test",
    JWT_SECRET: "test-jwt-secret",
    JWT_EXPIRES_IN: "30d",
  },
}));
vi.mock("@/lib/env.js", () => mockEnv);

vi.mock("@/lib/jwt.js", () => ({
  signToken: vi.fn().mockResolvedValue("mock.jwt.token"),
  verifyToken: vi.fn(),
}));

import { ssoLogin } from "@/services/auth.service.js";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { signSsoToken, type SsoAudience } from "@/lib/sso.js";

const dbMock = db as unknown as {
  user: Record<string, ReturnType<typeof vi.fn>>;
};

const admin = {
  id: "user-1",
  name: "Admin",
  email: "admin@instif.id",
  role: "ADMIN",
  status: "ACTIVE",
  phone: null,
  emailVerifiedAt: new Date("2026-01-01"),
};

function hubToken(
  overrides: {
    audience?: SsoAudience;
    email?: string | null;
    now?: number;
  } = {}
) {
  return signSsoToken(
    {
      userId: "hub-user-1",
      email:
        overrides.email === undefined ? "admin@instif.id" : overrides.email,
      role: "ADMIN",
      audience: overrides.audience ?? "cv-builder",
    },
    {
      secret: SECRET,
      ...(overrides.now === undefined ? {} : { now: overrides.now }),
    }
  );
}

/** The status code `ssoLogin` rejected with, or 200 when it resolved. */
async function statusOf(token: unknown): Promise<number> {
  try {
    await ssoLogin(token as string);
    return 200;
  } catch (error) {
    return error instanceof HttpError ? error.status : 500;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.env.SSO_SECRET = SECRET;
  dbMock.user.findFirst.mockResolvedValue(admin);
});

describe("ssoLogin", () => {
  it("exchanges a valid hub token for a local session", async () => {
    const result = await ssoLogin(hubToken());

    expect(result.token).toBe("mock.jwt.token");
    expect(result.user).toMatchObject({ id: "user-1", role: "ADMIN" });
  });

  it("prefers the local admin matching the hub email", async () => {
    await ssoLogin(hubToken({ email: "admin@instif.id" }));

    expect(dbMock.user.findFirst).toHaveBeenCalledWith({
      where: { role: "ADMIN", status: "ACTIVE", email: "admin@instif.id" },
    });
  });

  it("falls back to the oldest active admin when no email matches", async () => {
    dbMock.user.findFirst.mockResolvedValueOnce(null).mockResolvedValue(admin);

    await ssoLogin(hubToken({ email: "nobody@instif.id" }));

    expect(dbMock.user.findFirst).toHaveBeenLastCalledWith({
      where: { role: "ADMIN", status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("never signs in an inactive or non-admin account", async () => {
    await ssoLogin(hubToken());

    for (const call of dbMock.user.findFirst.mock.calls) {
      expect(call[0].where).toMatchObject({ role: "ADMIN", status: "ACTIVE" });
    }
  });

  // A token minted for another app must not open a session here, even though
  // every app in the ecosystem signs with the same secret.
  it.each(["news", "content", "tech", "crm"] as SsoAudience[])(
    "rejects a token minted for %s",
    async (audience) => {
      expect(await statusOf(hubToken({ audience }))).toBe(401);
      expect(dbMock.user.findFirst).not.toHaveBeenCalled();
    }
  );

  it("accepts a token only once", async () => {
    const token = hubToken();

    expect(await statusOf(token)).toBe(200);
    expect(await statusOf(token)).toBe(401);
    expect(await statusOf(token)).toBe(401);
  });

  it("rejects an expired token", async () => {
    expect(await statusOf(hubToken({ now: Date.now() - 600_000 }))).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = hubToken();
    mockEnv.env.SSO_SECRET = "a-different-secret-of-good-length";

    expect(await statusOf(token)).toBe(401);
  });

  it.each([
    ["garbage", "not-a-token"],
    ["an empty token", ""],
    ["a legacy v1 token", "eyJwYXlsb2FkIjoiYToxOjIifQ.deadbeef"],
    ["a non-string token", 12345],
  ])("rejects %s with 401", async (_label, token) => {
    expect(await statusOf(token)).toBe(401);
  });

  it("returns 503 when SSO_SECRET is not configured", async () => {
    const token = hubToken();
    mockEnv.env.SSO_SECRET = undefined as unknown as string;

    expect(await statusOf(token)).toBe(503);
  });

  it("returns 404 when the app has no admin to sign in as", async () => {
    dbMock.user.findFirst.mockResolvedValue(null);

    expect(await statusOf(hubToken())).toBe(404);
  });

  it("does not touch the database for an invalid token", async () => {
    await statusOf("not-a-token");
    expect(dbMock.user.findFirst).not.toHaveBeenCalled();
  });
});
