import type { CvData } from "@/lib/cvData.js";
import { renderClassicAts } from "@/services/templates/classic-ats.js";
import { renderModernProfessional } from "@/services/templates/modern-professional.js";
import { renderTwoColumnCompact } from "@/services/templates/two-column-compact.js";
import { renderMinimalistCreative } from "@/services/templates/minimalist-creative.js";
import { renderExecutiveSenior } from "@/services/templates/executive-senior.js";

export type TemplateRenderer = (data: CvData) => string;

export const templates: Record<string, TemplateRenderer> = {
  "classic-ats": renderClassicAts,
  "modern-professional": renderModernProfessional,
  "two-column-compact": renderTwoColumnCompact,
  "minimalist-creative": renderMinimalistCreative,
  "executive-senior": renderExecutiveSenior,
};
