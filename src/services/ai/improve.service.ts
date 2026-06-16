import { z } from "zod";
import { cvDataSchema } from "@/lib/cvData.js";
import { HttpError } from "@/lib/httpError.js";
import {
  requestStructured,
  type StructuredResult,
} from "@/services/ai/structured.service.js";

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

const SYSTEM_PROMPT =
  "Kamu adalah editor CV/resume profesional yang ahli membuat CV lolos ATS. Perbaiki wording bagian CV agar profesional, ringkas, dan berorientasi hasil (gunakan kata kerja aksi; pertahankan angka/metrik yang sudah ada) dalam bahasa yang sama dengan input. JANGAN menambah fakta, angka, atau skill baru, dan JANGAN mengarang pencapaian. Pertahankan struktur, id, dan tanggal apa adanya. Kembalikan bentuk data yang sama pada field data.";

function getSectionSchema(section: ImprovableSection): z.ZodType {
  return cvDataSchema.shape[section];
}

export async function improveSection(
  section: ImprovableSection,
  data: unknown
): Promise<StructuredResult<unknown>> {
  const parsed = getSectionSchema(section).safeParse(data);
  if (!parsed.success) {
    throw new HttpError(400, `data tidak sesuai bentuk section ${section}`);
  }
  const result = await requestStructured({
    system: SYSTEM_PROMPT,
    userContent: JSON.stringify({ section, data: parsed.data }),
    toolName: "improve_cv_section",
    toolDescription: `Simpan hasil perbaikan wording bagian ${section}`,
    schema: z.object({ data: getSectionSchema(section) }),
  });
  return { ...result, data: result.data.data };
}
