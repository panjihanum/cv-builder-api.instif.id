import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { signToken } from "@/lib/jwt.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import { requireRole } from "@/middleware/requireRole.js";

const app = new Hono<AuthEnv>();
app.get("/admin", requireAuth, requireRole("ADMIN"), (c) =>
  c.json({ ok: true })
);

async function tokenWithRole(role: string) {
  return signToken({ sub: "user-1", email: "user@instif.id", role });
}

describe("middleware/requireRole", () => {
  it("menolak request tanpa token", async () => {
    const res = await app.request("/admin");
    expect(res.status).toBe(401);
  });

  it("menolak user dengan role bukan admin", async () => {
    const token = await tokenWithRole("USER");
    const res = await app.request("/admin", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Akses ditolak");
  });

  it("meloloskan user dengan role admin", async () => {
    const token = await tokenWithRole("ADMIN");
    const res = await app.request("/admin", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});
