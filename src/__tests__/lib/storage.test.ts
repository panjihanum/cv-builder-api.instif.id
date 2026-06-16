import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import {
  LocalStorageProvider,
  S3StorageProvider,
  getStorageProvider,
} from "@/lib/storage.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

// Mock AWS SDK
const mockSend = vi.fn(async () => ({}));
vi.mock("@aws-sdk/client-s3", () => {
  const S3Client = vi.fn(function (this: object) {
    Object.assign(this, { send: mockSend });
  });
  const PutObjectCommand = vi.fn(function (
    this: object,
    input: Record<string, unknown>
  ) {
    Object.assign(this, { input });
  });
  return { S3Client, PutObjectCommand };
});

// Mock settings service
const mockGetSetting = vi.fn(async (_key: string) => null as string | null);
vi.mock("@/services/settings.service.js", () => ({
  getSetting: (key: string) => mockGetSetting(key),
}));

const TEST_BUFFER = Buffer.from("test-content");

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// LocalStorageProvider
// ---------------------------------------------------------------------------
describe("LocalStorageProvider", () => {
  it("menyimpan file dan mengembalikan path /uploads/<filename>", async () => {
    const provider = new LocalStorageProvider();
    const url = await provider.save(TEST_BUFFER, "test.webp");

    expect(url).toBe("/uploads/test.webp");
    expect(mkdir).toHaveBeenCalledWith("uploads", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("test.webp"),
      TEST_BUFFER
    );
  });

  it("menggunakan direktori custom bila disediakan", async () => {
    const provider = new LocalStorageProvider("custom-dir");
    await provider.save(TEST_BUFFER, "photo.webp");

    expect(mkdir).toHaveBeenCalledWith("custom-dir", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("photo.webp"),
      TEST_BUFFER
    );
  });
});

// ---------------------------------------------------------------------------
// S3StorageProvider
// ---------------------------------------------------------------------------
describe("S3StorageProvider", () => {
  const baseConfig = {
    bucket: "my-bucket",
    region: "ap-southeast-1",
    accessKeyId: "AKID",
    secretAccessKey: "secret",
  };

  it("mengupload ke S3 dan mengembalikan URL S3 standar", async () => {
    const provider = new S3StorageProvider(baseConfig);
    const url = await provider.save(TEST_BUFFER, "photo.webp", "image/webp");

    expect(url).toBe(
      "https://my-bucket.s3.ap-southeast-1.amazonaws.com/photo.webp"
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "my-bucket",
        Key: "photo.webp",
        Body: TEST_BUFFER,
        ContentType: "image/webp",
        ACL: "public-read",
      })
    );
  });

  it("menggunakan publicUrl bila dikonfigurasi", async () => {
    const provider = new S3StorageProvider({
      ...baseConfig,
      publicUrl: "https://cdn.example.com",
    });
    const url = await provider.save(TEST_BUFFER, "photo.webp", "image/webp");

    expect(url).toBe("https://cdn.example.com/photo.webp");
  });

  it("menggunakan endpoint custom (MinIO/R2) bila dikonfigurasi", async () => {
    const provider = new S3StorageProvider({
      ...baseConfig,
      endpoint: "http://minio.local:9000",
    });
    const url = await provider.save(TEST_BUFFER, "photo.webp", "image/webp");

    expect(url).toBe("http://minio.local:9000/my-bucket/photo.webp");
    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "http://minio.local:9000",
        forcePathStyle: true,
      })
    );
  });

  it("publicUrl mengalahkan endpoint dalam pembentukan URL", async () => {
    const provider = new S3StorageProvider({
      ...baseConfig,
      endpoint: "http://minio.local:9000",
      publicUrl: "https://cdn.example.com",
    });
    const url = await provider.save(TEST_BUFFER, "photo.webp", "image/webp");

    expect(url).toBe("https://cdn.example.com/photo.webp");
  });

  it("membuang trailing slash dari publicUrl", async () => {
    const provider = new S3StorageProvider({
      ...baseConfig,
      publicUrl: "https://cdn.example.com/",
    });
    const url = await provider.save(TEST_BUFFER, "file.txt", "text/plain");

    expect(url).toBe("https://cdn.example.com/file.txt");
  });
});

// ---------------------------------------------------------------------------
// getStorageProvider — factory
// ---------------------------------------------------------------------------
describe("getStorageProvider", () => {
  it("mengembalikan LocalStorageProvider saat storage.provider=local", async () => {
    mockGetSetting.mockImplementation(async (key) => {
      if (key === "storage.provider") return "local";
      return null;
    });

    const provider = await getStorageProvider();
    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it("mengembalikan LocalStorageProvider saat setting tidak ada (default)", async () => {
    mockGetSetting.mockResolvedValue(null);

    const provider = await getStorageProvider();
    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it("mengembalikan S3StorageProvider saat storage.provider=s3 dengan kredensial lengkap", async () => {
    mockGetSetting.mockImplementation(async (key) => {
      const map: Record<string, string> = {
        "storage.provider": "s3",
        "storage.s3.bucket": "my-bucket",
        "storage.s3.region": "ap-southeast-1",
        "storage.s3.accessKeyId": "AKID",
        "storage.s3.secretAccessKey": "secret",
      };
      return map[key] ?? null;
    });

    const provider = await getStorageProvider();
    expect(provider).toBeInstanceOf(S3StorageProvider);
  });

  it("fallback ke LocalStorageProvider saat s3 dipilih tapi kredensial tidak lengkap", async () => {
    mockGetSetting.mockImplementation(async (key) => {
      if (key === "storage.provider") return "s3";
      if (key === "storage.s3.bucket") return "my-bucket";
      // accessKeyId dan secretAccessKey tidak ada
      return null;
    });

    const provider = await getStorageProvider();
    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it("S3StorageProvider menggunakan endpoint dan publicUrl dari setting", async () => {
    mockGetSetting.mockImplementation(async (key) => {
      const map: Record<string, string> = {
        "storage.provider": "s3",
        "storage.s3.bucket": "bucket",
        "storage.s3.region": "us-east-1",
        "storage.s3.accessKeyId": "AK",
        "storage.s3.secretAccessKey": "SK",
        "storage.s3.endpoint": "http://minio:9000",
        "storage.s3.publicUrl": "https://cdn.example.com",
      };
      return map[key] ?? null;
    });

    const provider = await getStorageProvider();
    expect(provider).toBeInstanceOf(S3StorageProvider);

    // Verify the built URL uses publicUrl
    const url = await provider.save(TEST_BUFFER, "img.webp", "image/webp");
    expect(url).toBe("https://cdn.example.com/img.webp");
  });
});
