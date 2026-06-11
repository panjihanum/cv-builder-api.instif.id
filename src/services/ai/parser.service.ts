import { extname } from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { parse as parseCsv } from "csv-parse/sync";
import { HttpError } from "@/lib/httpError.js";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type SupportedFileType = "pdf" | "docx" | "csv";

export function detectFileType(
  filename: string,
  mimeType: string
): SupportedFileType {
  const extension = extname(filename).toLowerCase();
  if (mimeType === "application/pdf" || extension === ".pdf") {
    return "pdf";
  }
  if (mimeType === DOCX_MIME || extension === ".docx") {
    return "docx";
  }
  if (
    mimeType === "text/csv" ||
    mimeType === "application/csv" ||
    extension === ".csv"
  ) {
    return "csv";
  }
  throw new HttpError(
    400,
    "Tipe file tidak didukung, gunakan pdf, docx, atau csv"
  );
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractCsvText(buffer: Buffer): string {
  const rows = parseCsv(buffer, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];
  return rows
    .map((row) =>
      Object.entries(row)
        .map(([column, value]) => `${column}: ${value}`)
        .join("\n")
    )
    .join("\n\n");
}

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const fileType = detectFileType(filename, mimeType);
  let text: string;
  try {
    if (fileType === "pdf") {
      text = await extractPdfText(buffer);
    } else if (fileType === "docx") {
      text = await extractDocxText(buffer);
    } else {
      text = extractCsvText(buffer);
    }
  } catch {
    throw new HttpError(400, `File ${fileType} tidak bisa dibaca`);
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new HttpError(400, "Tidak ada teks yang bisa diekstrak dari file");
  }
  return trimmed;
}
