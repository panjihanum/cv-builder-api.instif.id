import { describe, it, expect, beforeEach, vi } from "vitest";
import puppeteer from "puppeteer";
import * as pdfService from "@/services/pdf.service.js";

const { pageMock, browserMock } = vi.hoisted(() => {
  const pageMock = {
    setContent: vi.fn(),
    pdf: vi.fn(),
    close: vi.fn(),
  };
  const browserMock = {
    newPage: vi.fn(async () => pageMock),
    close: vi.fn(),
  };
  return { pageMock, browserMock };
});

vi.mock("puppeteer", () => ({
  default: { launch: vi.fn(async () => browserMock) },
}));

beforeEach(async () => {
  await pdfService.closeBrowser();
  vi.clearAllMocks();
  pageMock.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
});

describe("pdf.service renderPdf", () => {
  it("merender html menjadi pdf a4 dengan background", async () => {
    const result = await pdfService.renderPdf("<html></html>");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(pageMock.setContent).toHaveBeenCalledWith("<html></html>", {
      waitUntil: "load",
    });
    const pdfArgs = pageMock.pdf.mock.calls[0][0];
    expect(pdfArgs.format).toBe("A4");
    expect(pdfArgs.printBackground).toBe(true);
  });

  it("menutup page setelah render sukses", async () => {
    await pdfService.renderPdf("<html></html>");
    expect(pageMock.close).toHaveBeenCalledTimes(1);
  });

  it("menutup page meski render gagal", async () => {
    pageMock.pdf.mockRejectedValue(new Error("render gagal"));
    await expect(pdfService.renderPdf("<html></html>")).rejects.toThrow(
      "render gagal"
    );
    expect(pageMock.close).toHaveBeenCalledTimes(1);
  });

  it("memakai satu browser singleton untuk banyak render", async () => {
    await pdfService.renderPdf("<html>1</html>");
    await pdfService.renderPdf("<html>2</html>");
    expect(vi.mocked(puppeteer.launch)).toHaveBeenCalledTimes(1);
    expect(browserMock.newPage).toHaveBeenCalledTimes(2);
  });

  it("memberi margin vertikal pada template biasa (bukan full-bleed)", async () => {
    await pdfService.renderPdf("<html></html>", "A4", false);
    const { margin } = pageMock.pdf.mock.calls[0][0];
    expect(margin).toEqual({
      top: "12mm",
      bottom: "12mm",
      left: "0",
      right: "0",
    });
  });

  it("tanpa margin untuk template full-bleed", async () => {
    await pdfService.renderPdf("<html></html>", "A4", true);
    const { margin } = pageMock.pdf.mock.calls[0][0];
    expect(margin).toEqual({ top: "0", bottom: "0", left: "0", right: "0" });
  });

  it("default tanpa argumen full-bleed memakai margin vertikal", async () => {
    await pdfService.renderPdf("<html></html>");
    const { margin } = pageMock.pdf.mock.calls[0][0];
    expect(margin.top).toBe("12mm");
    expect(margin.bottom).toBe("12mm");
  });
});

describe("pdf.service resolvePdfMargin", () => {
  it("template biasa: margin atas/bawah, kiri/kanan nol", () => {
    expect(pdfService.resolvePdfMargin(false)).toEqual({
      top: "12mm",
      bottom: "12mm",
      left: "0",
      right: "0",
    });
  });

  it("template full-bleed: semua margin nol", () => {
    expect(pdfService.resolvePdfMargin(true)).toEqual({
      top: "0",
      bottom: "0",
      left: "0",
      right: "0",
    });
  });
});
