import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { signToken } from "@/lib/jwt.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";

const app = new Hono<AuthEnv>();
app.get("/protected", requireAuth, (c) => c.json({ user: c.get("user") }));

describe("middleware/requireAuth", () => {
  it("menolak request tanpa header authorization", async () => {
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("menolak header tanpa skema bearer", async () => {
    const res = await app.request("/protected", {
      headers: { Authorization: "Basic abc" },
    });
    expect(res.status).toBe(401);
  });

  it("menolak token tidak valid", async () => {
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer token-palsu" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Token tidak valid");
  });

  it("meloloskan token valid dan mengisi user context", async () => {
    const token = await signToken({
      sub: "user-1",
      email: "user@instif.id",
      role: "USER",
    });
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { sub: string; role: string } };
    expect(body.user.sub).toBe("user-1");
    expect(body.user.role).toBe("USER");
  });
});
