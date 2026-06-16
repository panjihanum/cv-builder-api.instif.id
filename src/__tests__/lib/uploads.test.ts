import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveUploadedFile } from "@/lib/uploads.js";

// Stable mock save fn so we can assert calls
const mockSave = vi.fn(
  async (_buffer: Buffer, filename: string, _contentType: string) =>
    `/uploads/${filename}`
);

vi.mock("@/lib/storage.js", () => ({
  getStorageProvider: vi.fn(async () => ({ save: mockSave })),
}));

// 1x1 transparent PNG.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default mock return value
  mockSave.mockImplementation(
    async (_buffer: Buffer, filename: string, _contentType: string) =>
      `/uploads/${filename}`
  );
});

describe("lib/uploads saveUploadedFile", () => {
  it("mengonversi gambar yang diunggah menjadi webp terkompres", async () => {
    const url = await saveUploadedFile(
      new File([PNG_1x1], "foto.png", { type: "image/png" })
    );

    expect(url).toMatch(/^\/uploads\/[\w-]+\.webp$/);
    expect(mockSave).toHaveBeenCalledTimes(1);

    const [buffer, filename, contentType] = mockSave.mock.calls[0];
    expect(filename).toMatch(/^[\w-]+\.webp$/);
    expect(contentType).toBe("image/webp");
    // WebP magic bytes: "RIFF"<size>"WEBP".
    expect((buffer as Buffer).subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect((buffer as Buffer).subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("menyimpan file non-gambar apa adanya", async () => {
    const url = await saveUploadedFile(
      new File(["halo"], "catatan.txt", { type: "text/plain" })
    );

    expect(url).toMatch(/^\/uploads\/[\w-]+\.txt$/);
    expect(mockSave).toHaveBeenCalledTimes(1);

    const [buffer, filename, contentType] = mockSave.mock.calls[0];
    expect(filename).toMatch(/^[\w-]+\.txt$/);
    expect(contentType).toBe("text/plain");
    expect((buffer as Buffer).toString("utf8")).toBe("halo");
  });

  it("mengembalikan URL dari storage provider (mendukung URL S3 absolut)", async () => {
    mockSave.mockResolvedValueOnce(
      "https://bucket.s3.ap-southeast-1.amazonaws.com/photo.webp"
    );

    const url = await saveUploadedFile(
      new File([PNG_1x1], "photo.png", { type: "image/png" })
    );

    expect(url).toBe(
      "https://bucket.s3.ap-southeast-1.amazonaws.com/photo.webp"
    );
  });
});
