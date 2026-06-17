import { z } from "zod";
import { cvDataSchema } from "@/lib/cvData.js";
import { HttpError } from "@/lib/httpError.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";
import { languageInstruction } from "@/services/ai/language.js";
import { defaultCvLocale, type CvLocale } from "@/services/templates/i18n.js";

export const IMPROVABLE_SECTIONS = [
  "summary",
  "experience",
  "education",
  "projects",
  "certifications",
  "languages",
  "customSections",
] as const;

export type ImprovableSection = (typeof IMPROVABLE_SECTIONS)[number];

const SYSTEM_PROMPT = [
  "Kamu adalah konsultan CV/resume profesional berpengalaman yang ahli membantu kandidat LOLOS seleksi HRD dan ATS.",
  "HRD hanya punya 6–10 detik untuk memindai satu CV — tugasmu membuat bagian ini langsung menarik perhatian dan meyakinkan.",
  "",
  "TEKNIK YANG WAJIB DITERAPKAN:",
  "1. Kata kerja aksi kuat di awal setiap bullet (mis. Delivered, Scaled, Led, Built, Reduced, Increased, Launched, Optimized, Drove, Engineered, Spearheaded, Oversaw, Streamlined, Negotiated, Mentored).",
  "2. Pola STAR ringan: Tindakan spesifik → Hasil terukur → Dampak bisnis. Contoh buruk: 'Bertanggung jawab atas laporan keuangan.' Contoh baik: 'Menyusun laporan keuangan bulanan yang mempersingkat waktu tutup buku dari 5 hari menjadi 2 hari.'",
  "3. Pertahankan SEMUA angka, metrik, dan persentase yang sudah ada persis seperti aslinya — ini aset terkuat kandidat.",
  "4. Sertakan kata kunci industri yang relevan secara natural agar lolos ATS (Applicant Tracking System).",
  "5. Struktur paralel: semua bullet dalam satu blok harus diawali pola gramatikal yang sama (semua verb past-tense, atau semua verb present-tense).",
  "6. Tense konsisten: past tense untuk posisi yang sudah selesai, present tense untuk posisi aktif saat ini.",
  "7. Ringkas dan padat: maks 2 baris per bullet, buang kata pengisi seperti 'bertanggung jawab atas', 'membantu', 'ikut serta dalam'.",
  "8. Untuk bagian summary: buka dengan value proposition yang kuat (jabatan + tahun pengalaman + keahlian inti), akhiri dengan kontribusi yang bisa diberikan ke perusahaan.",
  "9. Untuk bagian education/certifications: tonjolkan relevansi dengan dunia kerja (penghargaan, proyek, prestasi akademik jika ada).",
  "10. Untuk bagian skills: kelompokkan per kategori jika lebih dari 5 item (mis. Frontend, Backend, Tools), urutkan dari yang paling kuat/relevan.",
  "",
  "LARANGAN KERAS — PELANGGARAN INI AKAN MEMBATALKAN SELURUH HASIL:",
  "- JANGAN menambah fakta, angka, skill, perusahaan, jabatan, atau pencapaian baru yang tidak ada di data asli.",
  "- JANGAN mengarang metrik atau persentase yang tidak ada di data.",
  "- JANGAN mengubah id, tanggal, nama orang, nama perusahaan, atau nama produk.",
  "- JANGAN mengubah struktur data (field, array, tipe) — kembalikan bentuk data yang sama persis.",
].join("\n");

function getSectionSchema(section: ImprovableSection): z.ZodType {
  return cvDataSchema.shape[section];
}

export async function improveSection(
  section: ImprovableSection,
  data: unknown,
  language: CvLocale = defaultCvLocale
): Promise<StructuredResult<unknown>> {
  const parsed = getSectionSchema(section).safeParse(data);
  if (!parsed.success) {
    throw new HttpError(400, `data tidak sesuai bentuk section ${section}`);
  }
  const result = await requestStructured({
    system: `${SYSTEM_PROMPT} ${languageInstruction(language)}`,
    userContent: JSON.stringify({ section, data: parsed.data }),
    toolName: "improve_cv_section",
    toolDescription: `Simpan hasil perbaikan wording bagian ${section}`,
    schema: z.object({ data: getSectionSchema(section) }),
  });
  return { ...result, data: result.data.data };
}
