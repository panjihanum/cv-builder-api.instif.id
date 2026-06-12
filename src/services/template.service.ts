import type { CvData } from "@/lib/cvData.js";
import { HttpError } from "@/lib/httpError.js";
import { templates, type TemplateEntry } from "@/services/templates/index.js";

export function listTemplateIds(): string[] {
  return Object.keys(templates);
}

function getTemplate(templateId: string): TemplateEntry {
  const entry = templates[templateId];
  if (!entry) {
    throw new HttpError(
      400,
      `Template tidak ditemukan, pilih salah satu: ${listTemplateIds().join(", ")}`
    );
  }
  return entry;
}

export function getTemplateCreditCost(templateId: string): number {
  return getTemplate(templateId).creditCost;
}

export function renderTemplate(templateId: string, data: CvData): string {
  return getTemplate(templateId).render(data);
}
