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
    `Kamu adalah penerjemah CV/resume profesional. Terjemahkan seluruh isi CV ke dalam ${langName}.`,
    "",
    "ATURAN WAJIB:",
    "1. Terjemahkan SEMUA konten teks: ringkasan (summary), jabatan (job titles), deskripsi pengalaman/pendidikan/proyek, nama skill yang generik, nama sertifikasi jika ada padanannya, dan isi custom section.",
    "2. JANGAN terjemahkan proper noun: nama perusahaan, nama produk/framework/tools (mis. React, PostgreSQL, Figma, Google, Tokopedia), nama universitas, nama orang.",
    "3. Pertahankan semua ID, tanggal, email, nomor telepon, URL, dan link PERSIS SAMA tanpa diubah.",
    "4. Pertahankan struktur data (field, array, tipe) PERSIS SAMA — hanya ubah konten teks di dalamnya.",
    `5. Set field \`language\` menjadi "${targetLocale}".`,
    "6. Untuk jabatan/job title: gunakan padanan yang paling natural dan profesional. Bila jabatan sudah umum dalam bahasa Inggris di industri (mis. 'Software Engineer', 'Product Manager'), boleh tetap dalam bahasa Inggris meski target bahasa bukan Inggris.",
    "7. Pertahankan semua tag HTML di field deskripsi (<ul>, <li>, <p>, <strong>, <em>) — hanya terjemahkan konten teks di dalamnya, jangan ubah tag-nya.",
    "8. JANGAN menambah, menghapus, atau mengarang informasi apapun.",
    "9. Terjemahan harus terdengar natural dan profesional, bukan terjemahan harfiah kaku.",
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
