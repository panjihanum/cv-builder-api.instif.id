import type { CvData } from "@/lib/cvData.js";
import { CREDIT_COSTS } from "@/config/pricing.js";
import { renderClassicAts } from "@/services/templates/classic-ats.js";
import { renderModernProfessional } from "@/services/templates/modern-professional.js";
import { renderTwoColumnCompact } from "@/services/templates/two-column-compact.js";
import { renderMinimalistCreative } from "@/services/templates/minimalist-creative.js";
import { renderExecutiveSenior } from "@/services/templates/executive-senior.js";
import { renderAurora } from "@/services/templates/aurora.js";
import { renderVibrant } from "@/services/templates/vibrant.js";
import { renderEditorial } from "@/services/templates/editorial.js";
import { renderDesignerStudio } from "@/services/templates/designer-studio.js";
import { renderGraphite } from "@/services/templates/graphite.js";
import { renderOnyx } from "@/services/templates/onyx.js";
import { renderBloom } from "@/services/templates/bloom.js";

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
  aurora: {
    render: renderAurora,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  vibrant: {
    render: renderVibrant,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  editorial: {
    render: renderEditorial,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  "designer-studio": {
    render: renderDesignerStudio,
    creditCost: CREDIT_COSTS.designerTemplate,
  },
  graphite: {
    render: renderGraphite,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  onyx: {
    render: renderOnyx,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
  bloom: {
    render: renderBloom,
    creditCost: CREDIT_COSTS.premiumTemplate,
  },
};
