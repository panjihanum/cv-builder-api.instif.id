import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { noIndex, ROBOTS_TXT } from "@/middleware/no-index.js";

const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function buildApp() {
  const app = new Hono();
  app.use("*", noIndex);
  app.get("/", (c) => c.html("<h1>landing</h1>"));
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/robots.txt", (c) => c.text(ROBOTS_TXT));
  app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));
  return app;
}

describe("noIndex middleware", () => {
  // The regression: an audit found every *-api host answering Googlebot with
  // 200 and indexable HTML, while instif.id's sites.ts documented these hosts
  // as sending X-Robots-Tag: noindex. The docs were right about the intent and
  // wrong about the fact.
  it("marks the HTML landing page noindex", async () => {
    const res = await buildApp().request("/", {
      headers: { "User-Agent": GOOGLEBOT, Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive"
    );
  });

  it("marks JSON responses noindex too", async () => {
    const res = await buildApp().request("/health");
    expect(res.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive"
    );
  });

  // A 404 that carries no header is still an indexable URL if something links
  // to it, so the header has to survive the error path as well.
  it("marks 404s noindex", async () => {
    const res = await buildApp().request("/tidak-ada");
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive"
    );
  });
});

describe("robots.txt", () => {
  it("disallows every crawler", async () => {
    const res = await buildApp().request("/robots.txt");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /");
  });

  it("does not accidentally allow anything", async () => {
    expect(ROBOTS_TXT).not.toMatch(/^\s*Allow:/m);
  });
});
