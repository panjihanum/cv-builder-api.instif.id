import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { saveUploadedFile } from "@/lib/uploads.js";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

// 1x1 transparent PNG.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lib/uploads saveUploadedFile", () => {
  it("mengonversi gambar yang diunggah menjadi webp terkompres", async () => {
    const url = await saveUploadedFile(
      new File([PNG_1x1], "foto.png", { type: "image/png" })
    );

    expect(url).toMatch(/^\/uploads\/[\w-]+\.webp$/);
    expect(mkdir).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledTimes(1);

    const written = vi.mocked(writeFile).mock.calls[0][1] as Buffer;
    // WebP magic bytes: "RIFF"<size>"WEBP".
    expect(written.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(written.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("menyimpan file non-gambar apa adanya", async () => {
    const url = await saveUploadedFile(
      new File(["halo"], "catatan.txt", { type: "text/plain" })
    );

    expect(url).toMatch(/^\/uploads\/[\w-]+\.txt$/);
    const written = vi.mocked(writeFile).mock.calls[0][1] as Buffer;
    expect(written.toString("utf8")).toBe("halo");
  });
});
