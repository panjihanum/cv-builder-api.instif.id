import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";

const EXTRACT_TOOL_NAME = "extract_cv_data";
const SYSTEM_PROMPT = [
  "Kamu adalah parser dan konsultan optimasi CV profesional. Ekstrak data CV terstruktur dari teks dokumen/profil yang diberikan secara akurat, sekaligus secara OTOMATIS MERAPIKAN, MERANGKUM, dan MENINGKATKAN kualitas penyajiannya agar berstandar emas HRD serta lolos screening ATS (Applicant Tracking System).",
  "",
  "OPTIMASI & PERANGKUMAN OTOMATIS:",
  "1. Ringkasan Profesional (summary):",
  "- Jika dokumen memiliki ringkasan/profil: poles dan rangkum agar padat, memikat, dan berorientasi nilai (maks 2–4 kalimat). Buka dengan peran/jabatan + estimasi pengalaman + keahlian utama, lalu tutup dengan proposisi nilai bagi organisasi.",
  "- Jika dokumen TIDAK memiliki ringkasan (atau ringkasannya kosong/sangat minim): buat dan rangkum secara otomatis dari riwayat pengalaman dan latar belakang kandidat yang diekstrak menjadi 2–3 kalimat ringkasan profesional yang meyakinkan HRD.",
  "- Bungkus narasi ringkasan dalam format HTML <p>...</p>.",
  "",
  "2. Pengalaman Kerja (experience) & Proyek (projects):",
  "- Tulis ulang deskripsi tugas menjadi poin-poin pencapaian yang tajam dalam format HTML <ul><li>...</li></ul> (satu <li> per poin, bersihkan bullet manual seperti '-' atau '•').",
  "- Mulai tiap poin dengan kata kerja aksi yang kuat (mis. Memimpin, Membangun, Mengembangkan, Mengoptimalkan, Merancang, Mengintegrasikan, Meluncurkan, Meningkatkan / Led, Developed, Spearheaded, Optimized).",
  '- Buang kata pengisi atau nada pasif (seperti "bertanggung jawab atas", "tugas meliputi", "membantu", "ikut serta").',
  "- Pola: aksi spesifik → hasil terukur / dampak nyata.",
  "- Bila dokumen mencantumkan angka, metrik, persentase, atau durasi (mis. efisiensi waktu, pertumbuhan, performa), PERTAHANKAN dan tebalkan metrik atau teknologi penting dengan <strong>.",
  "- Padatkan: tonjolkan 3–5 poin terkuat per posisi; hindari kalimat bertele-tele atau pengulangan.",
  "",
  "3. Keahlian (skills):",
  "- Rapikan ejaan resmi dan kapitalisasi standar industri (mis. 'React.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Tailwind CSS', 'Node.js').",
  "- Hapus duplikasi skill.",
  "- Kelompokkan ke dalam kategori yang logis lewat field `category` (mis. 'Bahasa Pemrograman', 'Framework & Library', 'Database', 'Tools & Platform', 'Soft Skills'). Skill sejenis WAJIB memiliki `category` yang sama persis.",
  "",
  "4. Pendidikan (education), Sertifikasi (certifications), & Bagian Kustom (customSections):",
  "- Ekstrak data secara rapi dan terstruktur.",
  "- Bila ada deskripsi kegiatan/prestasi di pendidikan atau customSections, format menjadi HTML yang bersih.",
  "",
  "FORMAT RICH TEXT HTML:",
  "- Untuk setiap field deskripsi (summary, experience.description, education.description, projects.description, dan customSections.items.body), keluarkan HTML rapi yang kompatibel dengan editor rich text, bukan teks polos.",
  "- Bila isinya daftar tugas/pencapaian atau lebih dari satu poin, ubah menjadi <ul><li>...</li></ul> dengan satu <li> per poin.",
  "- Bila isinya naratif, bungkus tiap paragraf dengan <p>...</p>.",
  "- Tebalkan istilah, nama perusahaan/produk, atau metrik penting dengan <strong>, beri penekanan dengan <em>, dan gunakan <u> hanya bila dokumen aslinya memang menggarisbawahi.",
  "- Hanya gunakan tag <p>, <ul>, <ol>, <li>, <strong>, <em>, <u>. Jangan pakai heading, tabel, gambar, style, atau script.",
  "",
  "KEAMANAN & INTEGRITAS FAKTA (MUTLAK - ANTI-HALUSINASI):",
  "- JANGAN PERNAH mengarang fakta fiktif: dilarang menciptakan nama perusahaan, institusi, gelar, tanggal, sertifikasi, atau metrik/angka yang tidak ada di dokumen.",
  "- Pertahankan semua nama asli, tanggal (tulis dalam format YYYY-MM), kontak (email, nomor telepon, link LinkedIn/portofolio), dan fakta riil persis sesuai dokumen.",
  "- Kosongkan field yang memang tidak diketahui dengan string kosong atau array kosong. Pertahankan bahasa utama dokumen.",
].join("\n");

export function buildCvDataJsonSchema(): Anthropic.Tool.InputSchema {
  return z.toJSONSchema(cvDataSchema) as Anthropic.Tool.InputSchema;
}

function withGeneratedId<T extends { id: string }>(item: T): T {
  return item.id ? item : { ...item, id: randomUUID() };
}

function fillGeneratedIds(data: CvData): CvData {
  return {
    ...data,
    personal: {
      ...data.personal,
      links: data.personal.links.map(withGeneratedId),
    },
    experience: data.experience.map(withGeneratedId),
    education: data.education.map(withGeneratedId),
    skills: data.skills.map(withGeneratedId),
    projects: data.projects.map(withGeneratedId),
    certifications: data.certifications.map(withGeneratedId),
    languages: data.languages.map(withGeneratedId),
    customSections: data.customSections.map((section) => ({
      ...withGeneratedId(section),
      items: section.items.map(withGeneratedId),
    })),
  };
}

export async function extractCvData(
  documentText: string,
  modelOverride?: string
): Promise<StructuredResult<CvData>> {
  const result = await requestStructured({
    system: SYSTEM_PROMPT,
    userContent: documentText,
    toolName: EXTRACT_TOOL_NAME,
    toolDescription:
      "Simpan data CV terstruktur hasil ekstraksi dari teks dokumen",
    schema: cvDataSchema,
    modelOverride,
  });
  return { ...result, data: fillGeneratedIds(result.data) };
}
