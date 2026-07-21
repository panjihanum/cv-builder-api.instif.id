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
  "Kamu adalah parser dokumen CV/resume profesional. Ekstrak data CV terstruktur dari teks dokumen yang diberikan secara akurat.",
  "Jangan mengarang informasi yang tidak ada di dokumen. Kosongkan field yang tidak diketahui dengan string kosong atau array kosong.",
  "Tulis tanggal dalam format YYYY-MM. Pertahankan bahasa asli dokumen.",
  "Untuk setiap field deskripsi (summary, experience.description, education.description, projects.description, dan customSections.items.body), keluarkan HTML rapi yang kompatibel dengan editor rich text, bukan teks polos:",
  "- Bila isinya daftar tugas/pencapaian atau lebih dari satu poin, ubah menjadi <ul><li>...</li></ul> dengan satu <li> per poin (rapikan, buang bullet manual seperti '-' atau '•').",
  "- Bila isinya naratif, bungkus tiap paragraf dengan <p>...</p>.",
  "- Tebalkan istilah, nama perusahaan/produk, atau metrik penting dengan <strong>, beri penekanan dengan <em>, dan gunakan <u> hanya bila dokumen aslinya memang menggarisbawahi.",
  "- Hanya gunakan tag <p>, <ul>, <ol>, <li>, <strong>, <em>, <u>. Jangan pakai heading, tabel, gambar, style, atau script.",
  "- Jangan menambah atau mengubah fakta; hanya rapikan struktur dan formatnya.",
  "Untuk keahlian (skills): bila dokumen mengelompokkan skill (mis. 'Bahasa Pemrograman: ...', 'Tools: ...'), pakai judul kelompok itu sebagai `category` tiap skill. Bila tidak ada pengelompokan eksplisit tapi skill banyak & beragam, kelompokkan sendiri secara logis (mis. 'Bahasa Pemrograman', 'Framework', 'Tools', 'Soft Skills'). Skill sejenis harus punya `category` yang sama persis; kosongkan `category` bila memang tidak ada pengelompokan yang wajar.",
].join(" ");

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
