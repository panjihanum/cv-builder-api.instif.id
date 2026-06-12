import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { UPLOADS_DIR } from "@/lib/uploads.js";
import { escapeHtml } from "@/services/templates/shared.js";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export function photoToDataUrl(photoUrl: string): string | null {
  if (/^https?:\/\//.test(photoUrl)) {
    return photoUrl;
  }
  if (!photoUrl.startsWith("/uploads/")) {
    return null;
  }
  const filename = basename(photoUrl);
  const mime = MIME_BY_EXTENSION[extname(filename).toLowerCase()];
  if (!mime) {
    return null;
  }
  const filePath = join(UPLOADS_DIR, filename);
  if (!existsSync(filePath)) {
    return null;
  }
  const base64 = readFileSync(filePath).toString("base64");
  return `data:${mime};base64,${base64}`;
}

export function renderPhoto(photoUrl: string): string {
  if (!photoUrl.trim()) {
    return "";
  }
  const source = photoToDataUrl(photoUrl);
  if (!source) {
    return "";
  }
  return `<img class="photo" src="${escapeHtml(source)}" alt="Foto profil" />`;
}
