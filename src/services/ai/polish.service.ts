import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";
import { languageInstruction } from "@/services/ai/language.js";

const SYSTEM_PROMPT = [
  "Kamu konsultan CV profesional yang membantu kandidat lolos screening HRD dan ATS. Rapikan dan optimalkan SELURUH CV agar meyakinkan dalam 6–10 detik pemindaian pertama.",
  "",
  "CARA MENULIS ULANG:",
  "- Mulai tiap bullet dengan kata kerja aksi (Memimpin, Membangun, Meningkatkan, Menurunkan, Meluncurkan, Mengoptimalkan).",
  '- Pola: aksi spesifik → hasil terukur → dampak. Buruk: "Bertanggung jawab atas laporan keuangan." Baik: "Menyusun laporan keuangan bulanan, memangkas waktu tutup buku dari 5 ke 2 hari."',
  '- Padat: maks 2 baris per bullet, buang kata pengisi ("bertanggung jawab atas", "membantu", "ikut serta").',
  "- Sisipkan kata kunci industri yang relevan secara natural agar lolos ATS.",
  "- Konsisten lintas bagian: istilah, nama peran, gaya, dan tense seragam (past untuk selesai, present untuk berjalan); pola gramatikal paralel per blok.",
  "- Summary: buka dengan jabatan + tahun pengalaman + keahlian inti, tutup dengan nilai yang bisa diberikan.",
  "- Buang duplikasi: bila poin sama muncul dua kali, simpan yang terkuat.",
  "",
  "WAJIB DIPATUHI (pelanggaran membatalkan hasil):",
  "- Jangan mengarang atau menambah fakta, angka, skill, perusahaan, jabatan, atau pencapaian apa pun.",
  "- Pertahankan semua angka/metrik, id, tanggal, dan nama (orang/perusahaan/produk) persis seperti aslinya.",
  "- Jangan ubah struktur CvData — kembalikan bentuk yang sama persis.",
].join("\n");

interface RequiredPart {
  label: string;
  isFilled: (data: CvData) => boolean;
}

const REQUIRED_PARTS: RequiredPart[] = [
  {
    label: "nama lengkap",
    isFilled: (data) => data.personal.fullName.trim().length > 0,
  },
  {
    label: "email",
    isFilled: (data) => data.personal.email.trim().length > 0,
  },
  { label: "ringkasan", isFilled: (data) => data.summary.trim().length > 0 },
  { label: "pengalaman", isFilled: (data) => data.experience.length > 0 },
  { label: "pendidikan", isFilled: (data) => data.education.length > 0 },
  { label: "keahlian", isFilled: (data) => data.skills.length > 0 },
];

export function findIncompleteParts(data: CvData): string[] {
  return REQUIRED_PARTS.filter((part) => !part.isFilled(data)).map(
    (part) => part.label
  );
}

export async function polishCv(
  data: CvData
): Promise<StructuredResult<CvData>> {
  return requestStructured({
    system: `${SYSTEM_PROMPT} ${languageInstruction(data.language)}`,
    userContent: JSON.stringify(data),
    toolName: "polish_cv_data",
    toolDescription: "Simpan seluruh data CV hasil perapian wording",
    schema: cvDataSchema,
  });
}
