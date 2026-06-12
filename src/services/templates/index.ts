import type { CvData } from "@/lib/cvData.js";
import { CREDIT_COSTS } from "@/config/pricing.js";
import { renderClassicAts } from "@/services/templates/classic-ats.js";
import { renderModernProfessional } from "@/services/templates/modern-professional.js";
import { renderTwoColumnCompact } from "@/services/templates/two-column-compact.js";
import { renderMinimalistCreative } from "@/services/templates/minimalist-creative.js";
import { renderExecutiveSenior } from "@/services/templates/executive-senior.js";

export type TemplateRenderer = (data: CvData) => string;

export interface TemplateEntry {
  render: TemplateRenderer;
  creditCost: number;
}

export const templates: Record<string, TemplateEntry> = {
  "classic-ats": { render: renderClassicAts, creditCost: 0 },
  "modern-professional": {
    render: renderModernProfessional,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  "two-column-compact": {
    render: renderTwoColumnCompact,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  "minimalist-creative": {
    render: renderMinimalistCreative,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  "executive-senior": {
    render: renderExecutiveSenior,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
};
