import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import * as cvService from "@/services/cv.service.js";
import { createEmptyCvData } from "@/lib/cvData.js";

const mockCv = {
  id: "cv-1",
  title: "Untitled CV",
  templateId: "classic-ats",
  data: createEmptyCvData(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cv.service", () => {
  it("mengembalikan daftar cv milik user", async () => {
    vi.mocked(db.cv.findMany).mockResolvedValue([mockCv] as never);
    const items = await cvService.listCvs("user-1");
    expect(items).toHaveLength(1);
    const args = vi.mocked(db.cv.findMany).mock.calls[0][0];
    expect(args?.where).toEqual({ userId: "user-1" });
  });

  it("membuat cv baru dengan data kosong default", async () => {
    vi.mocked(db.cv.create).mockResolvedValue(mockCv as never);
    await cvService.createCv("user-1");
    const args = vi.mocked(db.cv.create).mock.calls[0][0];
    expect(args.data.userId).toBe("user-1");
    expect(args.data.data).toEqual(createEmptyCvData());
    expect(args.data).not.toHaveProperty("title");
  });

  it("meneruskan title saat membuat cv dengan judul", async () => {
    vi.mocked(db.cv.create).mockResolvedValue(mockCv as never);
    await cvService.createCv("user-1", "CV Backend Engineer");
    const args = vi.mocked(db.cv.create).mock.calls[0][0];
    expect(args.data.title).toBe("CV Backend Engineer");
  });

  it("melempar 404 saat cv tidak ditemukan atau bukan milik user", async () => {
    vi.mocked(db.cv.findFirst).mockResolvedValue(null);
    await expect(cvService.getOwnedCv("user-1", "cv-x")).rejects.toMatchObject({
      status: 404,
    });
    const args = vi.mocked(db.cv.findFirst).mock.calls[0][0];
    expect(args?.where).toEqual({ id: "cv-x", userId: "user-1" });
  });

  it("memperbarui cv setelah cek kepemilikan", async () => {
    vi.mocked(db.cv.findFirst).mockResolvedValue(mockCv as never);
    vi.mocked(db.cv.update).mockResolvedValue({
      ...mockCv,
      title: "Baru",
    } as never);
    const cv = await cvService.updateCv("user-1", "cv-1", { title: "Baru" });
    expect(cv.title).toBe("Baru");
    const args = vi.mocked(db.cv.update).mock.calls[0][0];
    expect(args.where).toEqual({ id: "cv-1" });
  });

  it("menolak update cv milik user lain dengan 404", async () => {
    vi.mocked(db.cv.findFirst).mockResolvedValue(null);
    await expect(
      cvService.updateCv("user-2", "cv-1", { title: "Hack" })
    ).rejects.toMatchObject({ status: 404 });
    expect(db.cv.update).not.toHaveBeenCalled();
  });

  it("menghapus cv setelah cek kepemilikan", async () => {
    vi.mocked(db.cv.findFirst).mockResolvedValue(mockCv as never);
    vi.mocked(db.cv.delete).mockResolvedValue(mockCv as never);
    await cvService.deleteCv("user-1", "cv-1");
    expect(db.cv.delete).toHaveBeenCalledWith({ where: { id: "cv-1" } });
  });
});
