import { describe, it, expect, beforeEach, vi } from "vitest";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import * as parserService from "@/services/ai/parser.service.js";

vi.mock("mammoth", () => ({
  default: { extractRawText: vi.fn() },
}));

vi.mock("pdf-parse/lib/pdf-parse.js", () => ({
  default: vi.fn(),
}));

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parser.service detectFileType", () => {
  it("mendeteksi pdf via mimetype dan ekstensi", () => {
    expect(parserService.detectFileType("cv.pdf", "application/pdf")).toBe(
      "pdf"
    );
    expect(parserService.detectFileType("cv.pdf", "")).toBe("pdf");
  });

  it("mendeteksi docx via mimetype dan ekstensi", () => {
    expect(parserService.detectFileType("cv.docx", DOCX_MIME)).toBe("docx");
    expect(parserService.detectFileType("cv.docx", "")).toBe("docx");
  });

  it("mendeteksi csv via mimetype dan ekstensi", () => {
    expect(parserService.detectFileType("data.csv", "text/csv")).toBe("csv");
    expect(parserService.detectFileType("data.csv", "")).toBe("csv");
  });

  it("menolak tipe file lain dengan 400", () => {
    expect(() =>
      parserService.detectFileType("gambar.png", "image/png")
    ).toThrow();
    try {
      parserService.detectFileType("script.exe", "application/octet-stream");
    } catch (error) {
      expect(error).toMatchObject({ status: 400 });
    }
  });
});

describe("parser.service extractTextFromFile", () => {
  it("mengekstrak teks pdf via pdf-parse", async () => {
    vi.mocked(pdfParse).mockResolvedValue({ text: "isi teks pdf" } as never);
    const text = await parserService.extractTextFromFile(
      Buffer.from("pdf"),
      "cv.pdf",
      "application/pdf"
    );
    expect(text).toBe("isi teks pdf");
    expect(pdfParse).toHaveBeenCalledTimes(1);
  });

  it("mengekstrak teks docx via mammoth", async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValue({
      value: "isi teks docx",
    } as never);
    const text = await parserService.extractTextFromFile(
      Buffer.from("docx"),
      "cv.docx",
      DOCX_MIME
    );
    expect(text).toBe("isi teks docx");
    expect(mammoth.extractRawText).toHaveBeenCalledTimes(1);
  });

  it("mengekstrak csv menjadi teks berlabel kolom", async () => {
    const csv = Buffer.from("nama,email\nBudi,budi@instif.id\n");
    const text = await parserService.extractTextFromFile(
      csv,
      "data.csv",
      "text/csv"
    );
    expect(text).toContain("nama: Budi");
    expect(text).toContain("email: budi@instif.id");
  });

  it("melempar 400 saat hasil ekstraksi kosong", async () => {
    vi.mocked(pdfParse).mockResolvedValue({ text: "   " } as never);
    await expect(
      parserService.extractTextFromFile(
        Buffer.from("pdf"),
        "cv.pdf",
        "application/pdf"
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it("melempar 400 saat file rusak tidak bisa dibaca", async () => {
    vi.mocked(pdfParse).mockRejectedValue(new Error("broken pdf"));
    await expect(
      parserService.extractTextFromFile(
        Buffer.from("pdf"),
        "cv.pdf",
        "application/pdf"
      )
    ).rejects.toMatchObject({ status: 400 });
  });
});
