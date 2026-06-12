import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import { requestStructured } from "@/services/ai/structured.service.js";

const EXTRACT_TOOL_NAME = "extract_cv_data";
const SYSTEM_PROMPT =
  "Kamu adalah parser dokumen CV. Ekstrak data CV terstruktur dari teks dokumen yang diberikan. Jangan mengarang informasi yang tidak ada di dokumen. Kosongkan field yang tidak diketahui dengan string kosong atau array kosong. Tulis tanggal dalam format YYYY-MM.";

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

export async function extractCvData(documentText: string): Promise<CvData> {
  const data = await requestStructured({
    system: SYSTEM_PROMPT,
    userContent: documentText,
    toolName: EXTRACT_TOOL_NAME,
    toolDescription:
      "Simpan data CV terstruktur hasil ekstraksi dari teks dokumen",
    schema: cvDataSchema,
  });
  return fillGeneratedIds(data);
}
