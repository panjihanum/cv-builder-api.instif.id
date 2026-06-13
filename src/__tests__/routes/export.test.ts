import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { signToken } from "@/lib/jwt.js";
import { createEmptyCvData, cvDataSchema } from "@/lib/cvData.js";
import { exportRoutes } from "@/routes/export.js";

vi.mock("@/services/pdf.service.js", () => ({
  renderPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
}));

const app = new Hono();
app.route("/export", exportRoutes);
app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }
  throw err;
});

const cvRecord = {
  id: "cv-1",
  title: "CV Budi",
  templateId: "classic-ats",
  data: cvDataSchema.parse({
    ...createEmptyCvData(),
    personal: { fullName: "Budi Santoso", email: "budi@instif.id" },
  }),
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function requestExport(templateId: string) {
  const token = await signToken({
    sub: "user-1",
    email: "budi@instif.id",
    role: "USER",
  });
  return app.request("/export/pdf", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cvId: "cv-1", templateId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.cv.findFirst).mockResolvedValue(cvRecord as never);
});

describe("routes/export pdf", () => {
  it("export classic-ats gratis tanpa memotong kredit", async () => {
    const res = await requestExport("classic-ats");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(db.credit.findUnique).not.toHaveBeenCalled();
    expect(db.credit.updateMany).not.toHaveBeenCalled();
  });

  it("export template premium memotong biaya tier-nya (modern-professional = 4 kredit)", async () => {
    vi.mocked(db.credit.findUnique)
      .mockResolvedValueOnce({ balance: 5 } as never)
      .mockResolvedValueOnce({ balance: 1 } as never);
    vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 1 } as never);
    const res = await requestExport("modern-professional");
    expect(res.status).toBe(200);
    const args = vi.mocked(db.credit.updateMany).mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1", balance: { gte: 4 } });
    expect(args.data).toEqual({ balance: { decrement: 4 } });
  });

  it("melempar 402 saat saldo kurang untuk template premium", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      balance: 2,
    } as never);
    const res = await requestExport("modern-professional");
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
    expect(db.cv.findFirst).not.toHaveBeenCalled();
    expect(db.credit.updateMany).not.toHaveBeenCalled();
  });

  it("melempar 400 untuk template id tidak dikenal", async () => {
    const res = await requestExport("tidak-ada");
    expect(res.status).toBe(400);
  });
});
