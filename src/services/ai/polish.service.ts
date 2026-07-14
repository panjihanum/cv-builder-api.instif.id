import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";
import { languageInstruction } from "@/services/ai/language.js";

const SYSTEM_PROMPT = [
  "Kamu konsultan CV profesional yang membantu kandidat lolos screening HRD dan ATS. Analisis SELURUH CV, lalu terapkan rekomendasi perbaikan terbaik dan optimalkan agar meyakinkan dalam 6–10 detik pemindaian pertama.",
  "",
  "CARA MENULIS ULANG:",
  "- Mulai tiap bullet dengan kata kerja aksi (Memimpin, Membangun, Meningkatkan, Menurunkan, Meluncurkan, Mengoptimalkan).",
  '- Pola: aksi spesifik → hasil terukur → dampak. Buruk: "Bertanggung jawab atas laporan keuangan." Baik: "Menyusun laporan keuangan bulanan, memangkas waktu tutup buku dari 5 ke 2 hari."',
  '- Padat: maks 2 baris per bullet, buang kata pengisi ("bertanggung jawab atas", "membantu", "ikut serta").',
  "- Sisipkan kata kunci industri yang relevan secara natural agar lolos ATS.",
  "- Konsisten lintas bagian: istilah, nama peran, gaya, dan tense seragam (past untuk selesai, present untuk berjalan); pola gramatikal paralel per blok.",
  "- Summary: buka dengan jabatan + tahun pengalaman + keahlian inti, tutup dengan nilai yang bisa diberikan; maks 3–4 kalimat.",
  "- Keahlian: kelompokkan skill ke kategori logis lewat field `category` (mis. 'Bahasa Pemrograman', 'Framework', 'Tools', 'Soft Skills') — skill sejenis pakai `category` sama persis; rapikan ejaan nama skill & buang duplikat. Jangan ubah `level` atau `id`, jangan tambah/hapus skill.",
  "- Buang duplikasi: bila poin sama muncul dua kali, simpan yang terkuat.",
  "",
  "PANJANG & FOKUS (sesuaikan dengan isi CV — jangan dipanjang-panjangkan):",
  "- Proporsional dengan bobot kandidat: makin sedikit pengalaman, makin ringkas hasilnya. Target ideal 1 halaman untuk pengalaman di bawah 10 tahun.",
  "- Per pengalaman, tonjolkan 3–5 poin TERKUAT (yang punya hasil/dampak) di urutan atas; ringkas atau gabungkan poin yang lemah, umum, atau berulang — tanpa membuang angka/metrik yang sudah ada.",
  "- Utamakan mutu di atas kuantitas: hasil harus padat, tajam, dan maksimal dampaknya — bukan sekadar panjang.",
  "",
  "WAJIB DIPATUHI (pelanggaran membatalkan hasil):",
  "- Jangan mengarang atau menambah fakta, angka, skill, perusahaan, jabatan, atau pencapaian apa pun.",
  "- Pertahankan semua angka/metrik, id, tanggal, dan nama (orang/perusahaan/produk) persis seperti aslinya.",
  "- Jangan ubah struktur CvData (jumlah dan id tiap entri pengalaman/pendidikan/proyek tetap sama) — kembalikan bentuk yang sama persis.",
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
