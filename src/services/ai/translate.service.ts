import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";
import { type CvLocale } from "@/services/templates/i18n.js";

export const TRANSLATABLE_LOCALES = ["en", "id", "zh"] as const;
export type TranslatableLocale = (typeof TRANSLATABLE_LOCALES)[number];

const LOCALE_NAMES: Record<TranslatableLocale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
  zh: "Mandarin (Chinese Simplified / 中文简体)",
};

function buildSystemPrompt(targetLocale: TranslatableLocale): string {
  const langName = LOCALE_NAMES[targetLocale];
  return [
    `Kamu penerjemah CV/resume profesional. Terjemahkan seluruh isi CV ke ${langName} dengan natural dan profesional, bukan terjemahan harfiah.`,
    "",
    "ATURAN:",
    "1. Terjemahkan semua teks: summary, jabatan, deskripsi pengalaman/pendidikan/proyek, nama skill generik, kategori skill (field `category`, mis. 'Bahasa Pemrograman' → 'Programming Languages'), nama sertifikasi (bila ada padanan), dan isi custom section.",
    "2. Jangan terjemahkan proper noun: nama perusahaan, produk/framework/tools (React, PostgreSQL, Figma, dll), universitas, dan orang.",
    "3. Jabatan: pakai padanan paling natural; bila istilah Inggris sudah lazim di industri (mis. 'Software Engineer', 'Product Manager'), boleh dipertahankan.",
    "4. Pertahankan persis: id, tanggal, email, telepon, URL/link, dan tag HTML deskripsi (<ul>, <li>, <p>, <strong>, <em>, <u>) — hanya ubah teks di dalam tag.",
    `5. Pertahankan struktur data persis; hanya ubah konten teks. Set field \`language\` menjadi "${targetLocale}".`,
    "6. Jangan menambah, menghapus, atau mengarang informasi apa pun.",
  ].join("\n");
}

export async function translateCv(
  data: CvData,
  targetLocale: TranslatableLocale
): Promise<StructuredResult<CvData>> {
  return requestStructured({
    system: buildSystemPrompt(targetLocale),
    userContent: JSON.stringify(data),
    toolName: "translate_cv_data",
    toolDescription: `Simpan seluruh data CV hasil terjemahan ke ${LOCALE_NAMES[targetLocale]}`,
    schema: cvDataSchema,
  });
}

export function findIncompleteParts(data: CvData): string[] {
  if (data.personal.fullName.trim().length === 0) return ["nama lengkap"];
  if (data.summary.trim().length === 0) return ["ringkasan"];
  if (data.experience.length === 0) return ["pengalaman"];
  return [];
}

export { type CvLocale };
