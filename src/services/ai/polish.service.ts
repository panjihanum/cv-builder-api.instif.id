import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import { requestStructured } from "@/services/ai/structured.service.js";

const SYSTEM_PROMPT =
  "Kamu adalah editor CV profesional. Rapikan wording, bullet, dan konsistensi seluruh CV agar profesional dan ringkas dalam bahasa yang sama dengan input. JANGAN menambah fakta, angka, atau skill baru. Pertahankan struktur, id, dan tanggal apa adanya. Kembalikan bentuk CvData yang sama.";

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

export async function polishCv(data: CvData): Promise<CvData> {
  return requestStructured({
    system: SYSTEM_PROMPT,
    userContent: JSON.stringify(data),
    toolName: "polish_cv_data",
    toolDescription: "Simpan seluruh data CV hasil perapian wording",
    schema: cvDataSchema,
  });
}
