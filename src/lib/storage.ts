import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSetting } from "@/services/settings.service.js";

export interface StorageProvider {
  /** Saves buffer and returns the URL/path clients use to access the file. */
  save(buffer: Buffer, filename: string, contentType: string): Promise<string>;
}

export class LocalStorageProvider implements StorageProvider {
  private readonly dir: string;

  constructor(dir = "uploads") {
    this.dir = dir;
  }

  async save(buffer: Buffer, filename: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, filename), buffer);
    return `/uploads/${filename}`;
  }
}

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional: custom endpoint for MinIO / Cloudflare R2 / compatible services. */
  endpoint?: string;
  /** Optional: CDN or public URL prefix (e.g. https://cdn.example.com).
   *  If omitted, the standard AWS S3 URL is used. */
  publicUrl?: string;
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint
        ? { endpoint: config.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  async save(
    buffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      })
    );
    return this.buildUrl(filename);
  }

  private buildUrl(filename: string): string {
    if (this.config.publicUrl) {
      return `${this.config.publicUrl.replace(/\/$/, "")}/${filename}`;
    }
    if (this.config.endpoint) {
      return `${this.config.endpoint.replace(/\/$/, "")}/${this.config.bucket}/${filename}`;
    }
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${filename}`;
  }
}

/** Returns the active storage provider based on admin settings (DB-driven). */
export async function getStorageProvider(): Promise<StorageProvider> {
  const provider = (await getSetting("storage.provider")) ?? "local";
  if (provider === "s3") {
    const bucket = (await getSetting("storage.s3.bucket")) ?? "";
    const region = (await getSetting("storage.s3.region")) ?? "ap-southeast-1";
    const accessKeyId = (await getSetting("storage.s3.accessKeyId")) ?? "";
    const secretAccessKey =
      (await getSetting("storage.s3.secretAccessKey")) ?? "";
    const endpoint = (await getSetting("storage.s3.endpoint")) ?? undefined;
    const publicUrl = (await getSetting("storage.s3.publicUrl")) ?? undefined;

    if (bucket && accessKeyId && secretAccessKey) {
      return new S3StorageProvider({
        bucket,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint: endpoint || undefined,
        publicUrl: publicUrl || undefined,
      });
    }
    console.warn(
      "[storage] S3 provider selected but credentials incomplete, falling back to local"
    );
  }
  return new LocalStorageProvider();
}
