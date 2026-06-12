import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { HttpError } from "@/lib/httpError.js";
import { signToken } from "@/lib/jwt.js";
import { saveUploadedFile } from "@/lib/uploads.js";
import { uploadRoutes } from "@/routes/upload.js";

vi.mock("@/lib/uploads.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/uploads.js")>()),
  saveUploadedFile: vi.fn(async () => "/uploads/foto-baru.png"),
}));

const app = new Hono();
app.route("/upload", uploadRoutes);
app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }
  throw err;
});

async function postPhoto(file: File) {
  const token = await signToken({
    sub: "user-1",
    email: "budi@instif.id",
    role: "USER",
  });
  const form = new FormData();
  form.append("file", file);
  return app.request("/upload/photo", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveUploadedFile).mockResolvedValue("/uploads/foto-baru.png");
});

describe("routes/upload photo", () => {
  it("menyimpan foto jpg atau png dan mengembalikan url", async () => {
    const res = await postPhoto(
      new File(["isi-foto"], "foto.png", { type: "image/png" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "/uploads/foto-baru.png" });
    expect(saveUploadedFile).toHaveBeenCalledTimes(1);
  });

  it("menolak tipe file selain jpg dan png", async () => {
    const res = await postPhoto(
      new File(["bukan gambar"], "dokumen.pdf", { type: "application/pdf" })
    );
    expect(res.status).toBe(400);
    expect(saveUploadedFile).not.toHaveBeenCalled();
  });

  it("menolak foto lebih besar dari 2mb", async () => {
    const besar = new Uint8Array(2 * 1024 * 1024 + 1);
    const res = await postPhoto(
      new File([besar], "besar.png", { type: "image/png" })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Ukuran file maksimal 2MB");
    expect(saveUploadedFile).not.toHaveBeenCalled();
  });

  it("menolak request tanpa file", async () => {
    const token = await signToken({
      sub: "user-1",
      email: "budi@instif.id",
      role: "USER",
    });
    const form = new FormData();
    const res = await app.request("/upload/photo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(res.status).toBe(400);
  });
});
