import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { signToken } from "@/lib/jwt.js";
import { cvDataSchema, createEmptyCvData } from "@/lib/cvData.js";
import { aiRoutes } from "@/routes/ai.js";
import * as claudeService from "@/services/ai/claude.service.js";
import * as improveService from "@/services/ai/improve.service.js";
import * as polishService from "@/services/ai/polish.service.js";

vi.mock("@/services/ai/parser.service.js", () => ({
  extractTextFromFile: vi.fn(async () => "teks cv"),
}));

vi.mock("@/services/ai/claude.service.js", () => ({
  extractCvData: vi.fn(),
}));

vi.mock("@/services/ai/improve.service.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/ai/improve.service.js")
  >()),
  improveSection: vi.fn(),
}));

vi.mock("@/services/ai/polish.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/ai/polish.service.js")>()),
  polishCv: vi.fn(),
}));

const app = new Hono();
app.route("/ai", aiRoutes);
app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }
  throw err;
});

const completeCv = cvDataSchema.parse({
  personal: { fullName: "Budi Santoso", email: "budi@instif.id" },
  summary: "Backend engineer",
  experience: [{ id: "e1", company: "PT Maju", position: "Engineer" }],
  education: [{ id: "ed1", institution: "UI", degree: "S1" }],
  skills: [{ id: "s1", name: "TypeScript", level: 4 }],
});

async function authHeaders() {
  const token = await signToken({
    sub: "user-1",
    email: "budi@instif.id",
    role: "USER",
  });
  return { Authorization: `Bearer ${token}` };
}

async function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function mockBalance(before: number, after: number) {
  vi.mocked(db.credit.findUnique)
    .mockResolvedValueOnce({ balance: before } as never)
    .mockResolvedValueOnce({ balance: after } as never);
  vi.mocked(db.credit.updateMany).mockResolvedValue({ count: 1 } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("routes/ai parse-cv", () => {
  it("memotong dua kredit dan mengembalikan data plus sisa kredit", async () => {
    mockBalance(5, 3);
    vi.mocked(claudeService.extractCvData).mockResolvedValue(completeCv);
    const form = new FormData();
    form.append(
      "file",
      new File(["dummy"], "cv.pdf", { type: "application/pdf" })
    );
    const res = await app.request("/ai/parse-cv", {
      method: "POST",
      headers: await authHeaders(),
      body: form,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown; credits: number };
    expect(body.credits).toBe(3);
    const args = vi.mocked(db.credit.updateMany).mock.calls[0][0];
    expect(args.where).toEqual({ userId: "user-1", balance: { gte: 2 } });
    expect(args.data).toEqual({ balance: { decrement: 2 } });
  });

  it("melempar 402 saat saldo kurang dari dua", async () => {
    vi.mocked(db.credit.findUnique).mockResolvedValue({
      balance: 1,
    } as never);
    const form = new FormData();
    form.append(
      "file",
      new File(["dummy"], "cv.pdf", { type: "application/pdf" })
    );
    const res = await app.request("/ai/parse-cv", {
      method: "POST",
      headers: await authHeaders(),
      body: form,
    });
    expect(res.status).toBe(402);
    expect(claudeService.extractCvData).not.toHaveBeenCalled();
  });
});

describe("routes/ai improve-section", () => {
  it("memotong satu kredit dan mengembalikan section hasil perbaikan", async () => {
    mockBalance(4, 3);
    vi.mocked(improveService.improveSection).mockResolvedValue(
      "Ringkasan rapi"
    );
    const res = await postJson("/ai/improve-section", {
      section: "summary",
      data: "ringkasan lama",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown; credits: number };
    expect(body).toEqual({ data: "Ringkasan rapi", credits: 3 });
    expect(improveService.improveSection).toHaveBeenCalledWith(
      "summary",
      "ringkasan lama"
    );
    const args = vi.mocked(db.credit.updateMany).mock.calls[0][0];
    expect(args.data).toEqual({ balance: { decrement: 1 } });
  });

  it("menolak section di luar enum", async () => {
    const res = await postJson("/ai/improve-section", {
      section: "skills",
      data: [],
    });
    expect(res.status).toBe(400);
    expect(improveService.improveSection).not.toHaveBeenCalled();
  });
});

describe("routes/ai polish-cv", () => {
  const cvRecord = {
    id: "cv-1",
    title: "CV Budi",
    templateId: "classic-ats",
    data: completeCv,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("melempar 400 dengan daftar bagian kurang tanpa memotong kredit", async () => {
    vi.mocked(db.cv.findFirst).mockResolvedValue({
      ...cvRecord,
      data: createEmptyCvData(),
    } as never);
    const res = await postJson("/ai/polish-cv", { cvId: "cv-1" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(
      "Lengkapi dulu: nama lengkap, email, ringkasan, pengalaman, pendidikan, keahlian"
    );
    expect(polishService.polishCv).not.toHaveBeenCalled();
    expect(db.credit.updateMany).not.toHaveBeenCalled();
  });

  it("memotong lima kredit dan menyimpan hasil polish ke cv", async () => {
    mockBalance(8, 3);
    const polished = { ...completeCv, summary: "Ringkasan paling rapi" };
    vi.mocked(db.cv.findFirst).mockResolvedValue(cvRecord as never);
    vi.mocked(db.cv.update).mockResolvedValue(cvRecord as never);
    vi.mocked(polishService.polishCv).mockResolvedValue(polished);
    const res = await postJson("/ai/polish-cv", { cvId: "cv-1" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { summary: string };
      credits: number;
    };
    expect(body.data.summary).toBe("Ringkasan paling rapi");
    expect(body.credits).toBe(3);
    const updateArgs = vi.mocked(db.cv.update).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "cv-1" });
    expect(updateArgs.data).toEqual({ data: polished });
    const creditArgs = vi.mocked(db.credit.updateMany).mock.calls[0][0];
    expect(creditArgs.data).toEqual({ balance: { decrement: 5 } });
  });
});
