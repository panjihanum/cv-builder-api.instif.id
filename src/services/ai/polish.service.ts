import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";
import { languageInstruction } from "@/services/ai/language.js";

const SYSTEM_PROMPT = [
  "Kamu adalah konsultan CV/resume profesional berpengalaman yang ahli membantu kandidat LOLOS seleksi HRD dan ATS sekaligus.",
  "Tugasmu: rapikan dan optimalkan SELURUH CV agar HRD langsung terkesan dalam 6–10 detik pertama memindai.",
  "",
  "TEKNIK YANG WAJIB DITERAPKAN DI SELURUH CV:",
  "1. Kata kerja aksi kuat di awal setiap bullet (Delivered, Scaled, Led, Built, Reduced, Increased, Launched, Optimized, Drove, Engineered, Spearheaded, Negotiated, Streamlined, Mentored, dll.).",
  "2. Pola STAR ringan di setiap bullet pengalaman: Tindakan spesifik → Hasil terukur → Dampak bisnis.",
  "   Contoh buruk: 'Bertanggung jawab atas laporan keuangan bulanan.'",
  "   Contoh baik: 'Menyusun laporan keuangan bulanan yang mempersingkat waktu tutup buku dari 5 hari menjadi 2 hari.'",
  "3. Pertahankan SEMUA angka, metrik, dan persentase yang sudah ada persis seperti aslinya.",
  "4. Sertakan kata kunci industri relevan secara natural di seluruh CV agar lolos ATS.",
  "5. Struktur paralel: semua bullet dalam satu blok harus diawali pola gramatikal yang sama.",
  "6. Tense konsisten: past tense untuk posisi selesai, present tense untuk posisi aktif.",
  "7. Ringkas: maks 2 baris per bullet, buang kata pengisi ('bertanggung jawab atas', 'membantu', 'ikut serta dalam').",
  "8. Summary: buka dengan value proposition kuat (jabatan + tahun pengalaman + keahlian inti), akhiri dengan kontribusi yang bisa diberikan.",
  "9. Skills: kelompokkan per kategori jika lebih dari 5 item, urutkan dari yang paling kuat.",
  "10. Konsistensi lintas bagian: pastikan istilah, nama peran, dan gaya penulisan seragam di seluruh CV.",
  "11. Buang duplikasi: jika poin yang sama muncul di dua tempat, pilih yang paling kuat dan hapus yang lebih lemah.",
  "",
  "LARANGAN KERAS — PELANGGARAN INI AKAN MEMBATALKAN SELURUH HASIL:",
  "- JANGAN menambah fakta, angka, skill, perusahaan, jabatan, atau pencapaian baru yang tidak ada di data asli.",
  "- JANGAN mengarang metrik atau persentase yang tidak ada.",
  "- JANGAN mengubah id, tanggal, nama orang, nama perusahaan, atau nama produk.",
  "- JANGAN mengubah struktur CvData (field, array, tipe) — kembalikan bentuk CvData yang sama persis.",
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
