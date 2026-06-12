import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { photoToDataUrl, renderPhoto } from "@/services/templates/photo.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("templates/photo photoToDataUrl", () => {
  it("meneruskan url http dan https apa adanya", () => {
    expect(photoToDataUrl("https://cdn.instif.id/foto.png")).toBe(
      "https://cdn.instif.id/foto.png"
    );
    expect(photoToDataUrl("http://cdn.instif.id/foto.jpg")).toBe(
      "http://cdn.instif.id/foto.jpg"
    );
  });

  it("mengubah file uploads menjadi data url sesuai ekstensi", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(Buffer.from("isi-foto") as never);
    expect(photoToDataUrl("/uploads/foto.png")).toBe(
      `data:image/png;base64,${Buffer.from("isi-foto").toString("base64")}`
    );
    expect(photoToDataUrl("/uploads/foto.jpg")).toContain("data:image/jpeg;");
  });

  it("menetralkan path traversal dengan hanya memakai basename", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(photoToDataUrl("/uploads/../../etc/rahasia.png")).toBeNull();
    expect(vi.mocked(existsSync)).toHaveBeenCalledWith(
      join("uploads", "rahasia.png")
    );
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("mengembalikan null saat file tidak ada", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(photoToDataUrl("/uploads/hilang.png")).toBeNull();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("mengembalikan null untuk ekstensi tidak didukung dan path lain", () => {
    expect(photoToDataUrl("/uploads/script.svg")).toBeNull();
    expect(photoToDataUrl("relatif/foto.png")).toBeNull();
    expect(existsSync).not.toHaveBeenCalled();
  });
});

describe("templates/photo renderPhoto", () => {
  it("mengembalikan string kosong saat photo url kosong", () => {
    expect(renderPhoto("")).toBe("");
    expect(renderPhoto("   ")).toBe("");
  });

  it("mengembalikan string kosong saat sumber tidak valid", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(renderPhoto("/uploads/hilang.png")).toBe("");
  });

  it("merender img dengan src ter-escape", () => {
    const html = renderPhoto('https://cdn.instif.id/foto.png?a=1&b="x"');
    expect(html).toContain('<img class="photo"');
    expect(html).toContain("&amp;b=&quot;x&quot;");
    expect(html).not.toContain('b="x"');
  });
});
