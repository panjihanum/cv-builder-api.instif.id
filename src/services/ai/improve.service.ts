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
  "personal",
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
  personal: [
    "",
    "KHUSUS SECTION DATA DIRI (personal):",
    "- Ekstrak/rapikan nama lengkap (fullName), jabatan/spesialisasi (jobTitle), email, nomor telepon/WhatsApp (phone), alamat/lokasi kota (address), dan tautan sosial/portofolio (links).",
    "- Format nomor telepon agar mudah dibaca (misal: 0812-xxxx-xxxx).",
    "- Rapikan penulisan tautan (links) dengan label dan icon yang sesuai (misal: LinkedIn, GitHub, Website/Portfolio).",
  ].join("\n"),
  skills: [
    "",
    "KHUSUS SECTION KEAHLIAN (skills):",
    "- Kelompokkan skill ke dalam kategori yang logis dengan mengisi field `category` tiap skill (mis. 'Bahasa Pemrograman', 'Framework & Library', 'Tools', 'Database', 'Soft Skills', 'Bahasa'). Skill sejenis harus punya `category` yang sama persis.",
    "- Gunakan 2–5 kategori yang rapi; jangan buat kategori berisi satu skill kalau bisa digabung. Bila skill terlalu sedikit/umum, boleh biarkan `category` kosong.",
    "- Urutkan skill sehingga yang satu kategori berdekatan, dan taruh kategori/skill terpenting lebih dulu.",
    "- Rapikan penulisan nama skill (kapitalisasi & ejaan resmi, mis. 'nodejs' → 'Node.js'), buang duplikat.",
  ].join("\n"),
};

const SYSTEM_PROMPT = [
  "Kamu konsultan CV profesional yang membantu kandidat lolos screening HRD dan ATS. HRD memindai tiap CV hanya 6–10 detik, jadi bagian ini harus langsung meyakinkan.",
  "",
  "CARA MENULIS & STRUKTUR:",
  "- Mulai tiap bullet dengan kata kerja aksi (Memimpin, Membangun, Meningkatkan, Menurunkan, Meluncurkan, Mengoptimalkan).",
  '- Pola: aksi spesifik → hasil terukur → dampak. Buruk: "Bertanggung jawab atas laporan keuangan." Baik: "Menyusun laporan keuangan bulanan, memangkas waktu tutup buku dari 5 ke 2 hari."',
  '- Padat: maks 2 baris per bullet, buang kata pengisi ("bertanggung jawab atas", "membantu", "ikut serta").',
  "- Sisipkan kata kunci industri yang relevan secara natural agar lolos ATS.",
  "- Jika pengguna memberikan catatannya atau teks mentah, ekstrak informasi yang relevan dan susun dengan sangat rapi ke dalam bentuk data terstruktur yang diminta.",
  "",
  "WAJIB DIPATUHI:",
  "- Pertahankan metrik, nama perusahaan, tanggal, dan fakta utama jika ada.",
  "- Jika mengolah teks mentah/catatan bebas, rapikan tata bahasa, ejaan, dan struktur kalimat menjadi bahasa profesional.",
].join("\n");

function getSectionSchema(section: ImprovableSection): z.ZodType {
  return cvDataSchema.shape[section];
}

export async function improveSection(
  section: ImprovableSection,
  data: unknown,
  language: CvLocale = defaultCvLocale,
  rawText?: string
): Promise<StructuredResult<unknown>> {
  const schema = getSectionSchema(section);
  const hasRawText = Boolean(rawText && rawText.trim());

  if (!hasRawText) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new HttpError(400, `data tidak sesuai bentuk section ${section}`);
    }
  }

  const parsed = schema.safeParse(data);
  const currentData = parsed.success ? parsed.data : undefined;

  const sectionHint = SECTION_HINTS[section] ?? "";

  const userPayload = hasRawText
    ? {
        section,
        instruction: `Ekstrak dan susun data terstruktur untuk bagian ${section} CV dari teks mentah/catatan pengguna di bawah ini. Gabungkan dengan data yang sudah ada (jika relevan).`,
        rawInputText: rawText!.trim(),
        currentData: currentData ?? null,
      }
    : { section, data: currentData };

  const result = await requestStructured({
    system: `${SYSTEM_PROMPT}${sectionHint} ${languageInstruction(language)}`,
    userContent: JSON.stringify(userPayload),
    toolName: "improve_cv_section",
    toolDescription: `Simpan hasil perbaikan/ekstraksi data terstruktur bagian ${section}`,
    schema: z.object({ data: schema }),
  });
  return { ...result, data: result.data.data };
}
