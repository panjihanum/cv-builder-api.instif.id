import { randomInt } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db.js";

const EXPORT_DIR = join(process.env.UPLOADS_DIR ?? "uploads", "exports");
// Share links (and their PDF files) live for 3 days, then are auto-deleted by
// cleanupExpiredExports(). resolveExportLink() also refuses anything past expiry.
const EXPORT_TTL_DAYS = 3;

// Non-ambiguous alphabet for the short code — no 0/O/1/l/i so the link is easy
// to read aloud and retype.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 4;

function exportFilePath(token: string): string {
  return join(EXPORT_DIR, `${token}.pdf`);
}

/** Slugify a CV title into a readable URL fragment (e.g. "Budi Santoso" -> "budi-santoso"). */
function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "cv";
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Build a unique, memorable slug like "budi-santoso-7k4m", retrying on collision. */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugifyTitle(title);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slug = `${base}-${randomCode()}`;
    const existing = await db.exportLink.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  // Extremely unlikely fallback — widen the code so collisions are negligible.
  return `${base}-${randomCode()}${randomCode()}`;
}

export async function createExportLink(
  userId: string | null,
  cvTitle: string,
  pdfBuffer: Buffer
): Promise<string> {
  const expiresAt = new Date(
    Date.now() + EXPORT_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  const slug = await generateUniqueSlug(cvTitle);
  const record = await db.exportLink.create({
    data: { userId, cvTitle, expiresAt, slug },
  });
  await mkdir(EXPORT_DIR, { recursive: true });
  await writeFile(exportFilePath(record.id), pdfBuffer);
  // The slug is the public token shared in the URL; resolveExportLink accepts
  // it (and falls back to the cuid id for links created before slugs existed).
  return slug;
}

export async function resolveExportLink(
  token: string
): Promise<{ cvTitle: string; filePath: string } | null> {
  const record = await db.exportLink.findFirst({
    where: { OR: [{ slug: token }, { id: token }] },
  });
  if (!record || record.expiresAt < new Date()) return null;
  // Increment access count fire-and-forget — don't slow down or fail the download
  db.exportLink
    .update({
      where: { id: record.id },
      data: { accessCount: { increment: 1 } },
    })
    .catch(console.error);
  return { cvTitle: record.cvTitle, filePath: exportFilePath(record.id) };
}

export async function readExportFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export type ExportLinkItem = {
  id: string;
  slug: string | null;
  cvTitle: string;
  expiresAt: Date;
  createdAt: Date;
  accessCount: number;
  expired: boolean;
};

export async function listUserExports(
  userId: string
): Promise<ExportLinkItem[]> {
  const records = await db.exportLink.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      cvTitle: true,
      expiresAt: true,
      createdAt: true,
      accessCount: true,
    },
  });
  const now = new Date();
  return records.map((r) => ({ ...r, expired: r.expiresAt < now }));
}

/**
 * Delete expired share links and their PDF files. Run on a timer so links
 * "auto-delete" after their TTL instead of lingering on disk forever. Returns
 * the number of links removed.
 */
export async function cleanupExpiredExports(): Promise<number> {
  const expired = await db.exportLink.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  await Promise.allSettled(expired.map((r) => unlink(exportFilePath(r.id))));
  await db.exportLink.deleteMany({
    where: { id: { in: expired.map((r) => r.id) } },
  });
  return expired.length;
}
