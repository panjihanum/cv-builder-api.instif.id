import type { CvData } from "@/lib/cvData.js";
import type { StructuredResult } from "@/services/ai/structured.service.js";
import * as claudeService from "@/services/ai/claude.service.js";
import { scrapeUrl, ScrapeError } from "@/services/ai/linkedin.service.js";
import { HttpError } from "@/lib/httpError.js";

export interface UrlParseResult {
  isValid: boolean;
  data: StructuredResult<CvData>["data"];
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Scrape URL, lakukan validasi manual konten, dan ekstrak data CV via AI.
 * Throws HttpError(400) jika scraping atau validasi manual gagal (tanpa memotong kredit).
 */
export async function parseUrlForCv(url: string): Promise<UrlParseResult> {
  // 1. Scrape halaman terlebih dahulu
  let pageContent: string;
  try {
    console.log(`[URL Parse] Scraping URL: ${url}...`);
    pageContent = await scrapeUrl(url);
  } catch (err) {
    const message =
      err instanceof ScrapeError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Gagal mengakses URL";
    console.warn(`[URL Parse Failed] Scrape error for ${url}: ${message}`);
    throw new HttpError(400, `Gagal mengambil konten URL: ${message}`);
  }

  // 2. Validasi manual pada teks hasil scraping sebelum panggil AI
  const cleanText = pageContent
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  console.log(
    `[URL Parse] Scraped text length: ${cleanText.length} characters.`
  );

  if (cleanText.length < 150) {
    console.warn(
      `[URL Parse Failed] Scraped content too short (${cleanText.length} chars).`
    );
    throw new HttpError(
      400,
      "Konten teks dari URL terlalu pendek atau tidak mengandung profil yang dapat dibaca."
    );
  }

  // 3. Ekstrak data CV dari konten halaman menggunakan Claude AI
  console.log(`[URL Parse] Passing scraped text to Claude AI...`);
  const result = await claudeService.extractCvData(cleanText);

  // Cek apakah hasil ekstraksi punya data yang cukup bermakna
  const hasContent =
    result.data.personal.fullName.trim().length > 0 ||
    result.data.experience.length > 0 ||
    result.data.education.length > 0 ||
    result.data.skills.length > 0;

  if (!hasContent) {
    console.warn(
      `[URL Parse Failed] AI extraction produced empty profile fields.`
    );
    throw new HttpError(
      400,
      "Konten halaman tidak mengandung informasi profil yang dapat diekstrak."
    );
  }

  return {
    isValid: true,
    data: result.data,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
  };
}
