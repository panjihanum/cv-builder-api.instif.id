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
  "skills",
  "projects",
  "certifications",
  "languages",
  "customSections",
] as const;

export type ImprovableSection = (typeof IMPROVABLE_SECTIONS)[number];

// Extra, section-specific guidance appended to the base prompt.
const SECTION_HINTS: Partial<Record<ImprovableSection, string>> = {
  skills: [
    "",
    "KHUSUS SECTION KEAHLIAN (skills):",
    "- Kelompokkan skill ke dalam kategori yang logis dengan mengisi field `category` tiap skill (mis. 'Bahasa Pemrograman', 'Framework & Library', 'Tools', 'Database', 'Soft Skills', 'Bahasa'). Skill sejenis harus punya `category` yang sama persis.",
    "- Gunakan 2–5 kategori yang rapi; jangan buat kategori berisi satu skill kalau bisa digabung. Bila skill terlalu sedikit/umum, boleh biarkan `category` kosong.",
    "- Urutkan skill sehingga yang satu kategori berdekatan, dan taruh kategori/skill terpenting lebih dulu.",
    "- Rapikan penulisan nama skill (kapitalisasi & ejaan resmi, mis. 'nodejs' → 'Node.js'), buang duplikat.",
    "- JANGAN menambah skill baru, menghapus skill yang ada, atau mengubah `level` dan `id`.",
  ].join("\n"),
};

const SYSTEM_PROMPT = [
  "Kamu konsultan CV profesional yang membantu kandidat lolos screening HRD dan ATS. HRD memindai tiap CV hanya 6–10 detik, jadi bagian ini harus langsung meyakinkan.",
  "",
  "CARA MENULIS ULANG:",
  "- Mulai tiap bullet dengan kata kerja aksi (Memimpin, Membangun, Meningkatkan, Menurunkan, Meluncurkan, Mengoptimalkan).",
  '- Pola: aksi spesifik → hasil terukur → dampak. Buruk: "Bertanggung jawab atas laporan keuangan." Baik: "Menyusun laporan keuangan bulanan, memangkas waktu tutup buku dari 5 ke 2 hari."',
  '- Padat: maks 2 baris per bullet, buang kata pengisi ("bertanggung jawab atas", "membantu", "ikut serta").',
  "- Sisipkan kata kunci industri yang relevan secara natural agar lolos ATS.",
  "- Konsisten: pola gramatikal & tense paralel dalam satu blok (past tense untuk posisi selesai, present untuk yang berjalan).",
  "- Summary: buka dengan jabatan + tahun pengalaman + keahlian inti, tutup dengan nilai yang bisa diberikan.",
  "",
  "WAJIB DIPATUHI (pelanggaran membatalkan hasil):",
  "- Jangan mengarang atau menambah fakta, angka, skill, perusahaan, jabatan, atau pencapaian apa pun.",
  "- Pertahankan semua angka/metrik, id, tanggal, dan nama (orang/perusahaan/produk) persis seperti aslinya.",
  "- Jangan ubah struktur data — kembalikan bentuk yang sama persis.",
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
  const sectionHint = SECTION_HINTS[section] ?? "";
  const result = await requestStructured({
    system: `${SYSTEM_PROMPT}${sectionHint} ${languageInstruction(language)}`,
    userContent: JSON.stringify({ section, data: parsed.data }),
    toolName: "improve_cv_section",
    toolDescription: `Simpan hasil perbaikan wording bagian ${section}`,
    schema: z.object({ data: getSectionSchema(section) }),
  });
  return { ...result, data: result.data.data };
}
