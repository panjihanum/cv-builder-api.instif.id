import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";
import { languageInstruction } from "@/services/ai/language.js";

const SYSTEM_PROMPT =
  "Kamu adalah editor CV/resume profesional yang ahli membuat CV lolos ATS. Rapikan wording, bullet, dan konsistensi seluruh CV agar profesional, ringkas, dan berorientasi hasil (gunakan kata kerja aksi; pertahankan angka/metrik yang sudah ada). JANGAN menambah fakta, angka, atau skill baru, dan JANGAN mengarang pencapaian. Pertahankan struktur, id, dan tanggal apa adanya. Kembalikan bentuk CvData yang sama.";

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
