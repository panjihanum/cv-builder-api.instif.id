import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { HttpError } from "@/lib/httpError.js";

export const UPLOADS_DIR = "uploads";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Uploaded images are re-encoded to compressed WebP so server storage stays
// light. Profile photos never need to exceed this dimension.
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
  await mkdir(UPLOADS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());

  // Convert any uploaded image to compressed WebP to keep the server light.
  if (file.type.startsWith("image/")) {
    const webp = await sharp(buffer)
      .rotate() // honour EXIF orientation before metadata is stripped
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(UPLOADS_DIR, filename), webp);
    return `/uploads/${filename}`;
  }

  // Non-image uploads keep their original format.
  const extension = extname(file.name).toLowerCase();
  const filename = `${randomUUID()}${extension}`;
  await writeFile(join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
