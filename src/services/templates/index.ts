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

const tierCost = CREDIT_COSTS.templateTier;

export const templates: Record<string, TemplateEntry> = {
  "classic-ats": { render: renderClassicAts, creditCost: tierCost.free },
  "modern-professional": {
    render: renderModernProfessional,
    creditCost: tierCost.basic,
  },
  "two-column-compact": {
    render: renderTwoColumnCompact,
    creditCost: tierCost.standard,
  },
  "minimalist-creative": {
    render: renderMinimalistCreative,
    creditCost: tierCost.standard,
  },
  "executive-senior": {
    render: renderExecutiveSenior,
    creditCost: tierCost.basic,
  },
  aurora: {
    render: renderAurora,
    creditCost: tierCost.premium,
  },
  vibrant: {
    render: renderVibrant,
    creditCost: tierCost.elite,
  },
  editorial: {
    render: renderEditorial,
    creditCost: tierCost.elite,
  },
  "designer-studio": {
    render: renderDesignerStudio,
    creditCost: tierCost.flagship,
  },
  graphite: {
    render: renderGraphite,
    creditCost: tierCost.premium,
  },
  onyx: {
    render: renderOnyx,
    creditCost: tierCost.elite,
  },
  bloom: {
    render: renderBloom,
    creditCost: tierCost.flagship,
  },
};
