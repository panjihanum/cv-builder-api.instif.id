import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/httpError.js";

export const UPLOADS_DIR = "uploads";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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
  const extension = extname(file.name).toLowerCase();
  const filename = `${randomUUID()}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
