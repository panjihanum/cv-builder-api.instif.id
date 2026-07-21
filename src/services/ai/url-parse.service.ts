import type { CvData } from "@/lib/cvData.js";
import type { StructuredResult } from "@/services/ai/structured.service.js";
import * as claudeService from "@/services/ai/claude.service.js";
import { scrapeUrl, ScrapeError } from "@/services/ai/linkedin.service.js";

/**
 * Model yang digunakan untuk fitur parse-url.
 * Pakai Haiku untuk kecepatan dan efisiensi biaya.
 */
const HAIKU_MODEL = "claude-haiku-4-5";

export interface UrlParseResult {
  /** true jika URL berhasil diakses dan data CV berhasil diekstrak. */
  isValid: boolean;
  /** Data CV hasil ekstraksi (hanya ada jika isValid=true). */
  data?: StructuredResult<CvData>["data"];
  inputTokens: number;
  outputTokens: number;
  model: string;
  /** Alasan kegagalan jika isValid=false. */
  reason?: string;
}

/**
 * Scrape URL dan ekstrak data CV menggunakan Claude Haiku.
 *
 * Credit policy:
 * - isValid=true  → potong 3 kredit (aiUrlParse)
 * - isValid=false → potong 1 kredit (aiUrlParseInvalid)
 */
export async function parseUrlForCv(url: string): Promise<UrlParseResult> {
  // 1. Scrape halaman
  let pageContent: string;
  try {
    pageContent = await scrapeUrl(url);
  } catch (err) {
    if (err instanceof ScrapeError) {
      return {
        isValid: false,
        inputTokens: 0,
        outputTokens: 0,
        model: HAIKU_MODEL,
        reason: err.message,
      };
    }
    return {
      isValid: false,
      inputTokens: 0,
      outputTokens: 0,
      model: HAIKU_MODEL,
      reason: err instanceof Error ? err.message : "Gagal mengakses URL",
    };
  }

  // 2. Ekstrak data CV dari konten halaman menggunakan Haiku
  try {
    const result = await claudeService.extractCvData(pageContent, HAIKU_MODEL);

    // Cek apakah hasil ekstraksi punya data yang cukup bermakna
    const hasContent =
      result.data.personal.fullName.trim().length > 0 ||
      result.data.experience.length > 0 ||
      result.data.education.length > 0 ||
      result.data.skills.length > 0;

    if (!hasContent) {
      return {
        isValid: false,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: result.model,
        reason:
          "Konten halaman tidak mengandung informasi profil yang dapat diekstrak",
      };
    }

    return {
      isValid: true,
      data: result.data,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      model: result.model,
    };
  } catch {
    return {
      isValid: false,
      inputTokens: 0,
      outputTokens: 0,
      model: HAIKU_MODEL,
      reason: "AI gagal mengekstrak data dari konten halaman",
    };
  }
}
