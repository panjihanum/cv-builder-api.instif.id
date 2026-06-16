import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { HttpError } from "@/lib/httpError.js";
import { getStorageProvider } from "@/lib/storage.js";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MAX_IMAGE_DIMENSION = 1200;
const WEBP_QUALITY = 80;

export interface AllowedFileRule {
  mimeTypes: string[];
  extensions: string[];
  label: string;
  maxBytes?: number;
}

export function assertUploadedFile(
  value: unknown,
  allowed: AllowedFileRule
): File {
  if (!(value instanceof File)) {
    throw new HttpError(400, "File wajib diunggah pada field file");
  }
  if (value.size === 0) {
    throw new HttpError(400, "File kosong");
  }
  const maxBytes = allowed.maxBytes ?? MAX_UPLOAD_BYTES;
  if (value.size > maxBytes) {
    throw new HttpError(
      400,
      `Ukuran file maksimal ${Math.floor(maxBytes / (1024 * 1024))}MB`
    );
  }
  const extension = extname(value.name).toLowerCase();
  const mimeAllowed = allowed.mimeTypes.includes(value.type);
  const extensionAllowed = allowed.extensions.includes(extension);
  if (!mimeAllowed && !extensionAllowed) {
    throw new HttpError(
      400,
      `Tipe file tidak didukung, gunakan ${allowed.label}`
    );
  }
  return value;
}

export async function saveUploadedFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = await getStorageProvider();

  if (file.type.startsWith("image/")) {
    const webp = await sharp(buffer)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const filename = `${randomUUID()}.webp`;
    return storage.save(webp, filename, "image/webp");
  }

  const extension = extname(file.name).toLowerCase();
  const filename = `${randomUUID()}${extension}`;
  return storage.save(buffer, filename, file.type);
}
