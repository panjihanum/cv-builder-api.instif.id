import type { CvData } from "@/lib/cvData.js";
import { HttpError } from "@/lib/httpError.js";
import { templates } from "@/services/templates/index.js";

export function listTemplateIds(): string[] {
  return Object.keys(templates);
}

export function renderTemplate(templateId: string, data: CvData): string {
  const render = templates[templateId];
  if (!render) {
    throw new HttpError(
      400,
      `Template tidak ditemukan, pilih salah satu: ${listTemplateIds().join(", ")}`
    );
  }
  return render(data);
}
