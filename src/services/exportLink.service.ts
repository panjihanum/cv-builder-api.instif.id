import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db.js";
import { UPLOADS_DIR } from "@/lib/uploads.js";

const EXPORT_DIR = join(UPLOADS_DIR, "exports");
const EXPORT_TTL_DAYS = 7;

function exportFilePath(token: string): string {
  return join(EXPORT_DIR, `${token}.pdf`);
}

export async function createExportLink(
  userId: string,
  cvTitle: string,
  pdfBuffer: Buffer
): Promise<string> {
  const expiresAt = new Date(
    Date.now() + EXPORT_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  const record = await db.exportLink.create({
    data: { userId, cvTitle, expiresAt },
  });
  await mkdir(EXPORT_DIR, { recursive: true });
  await writeFile(exportFilePath(record.id), pdfBuffer);
  return record.id;
}

export async function resolveExportLink(
  token: string
): Promise<{ cvTitle: string; filePath: string } | null> {
  const record = await db.exportLink.findUnique({ where: { id: token } });
  if (!record || record.expiresAt < new Date()) return null;
  return { cvTitle: record.cvTitle, filePath: exportFilePath(record.id) };
}

export async function readExportFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
