import type { CvData } from "@/lib/cvData.js";
import type { TemplateTier } from "@/config/pricing.js";
import { renderClassicAts } from "@/services/templates/classic-ats.js";
import { renderModernProfessional } from "@/services/templates/modern-professional.js";
import { renderAtsProfessional } from "@/services/templates/ats-professional.js";
import { renderAtsRecruiterFocus } from "@/services/templates/ats-recruiter-focus.js";
import { renderAtsExecutive } from "@/services/templates/ats-executive.js";
import { renderAtsCompact } from "@/services/templates/ats-compact.js";
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
  /**
   * Tier biaya visual. Biaya kredit aktualnya diresolusi dari pengaturan admin
   * (DB) saat dipakai, bukan disimpan di sini, agar harga fleksibel per web.
   */
  tier: TemplateTier;
}

export const templates: Record<string, TemplateEntry> = {
  "classic-ats": { render: renderClassicAts, tier: "free" },
  "modern-professional": { render: renderModernProfessional, tier: "basic" },
  "ats-professional": { render: renderAtsProfessional, tier: "basic" },
  "ats-recruiter-focus": {
    render: renderAtsRecruiterFocus,
    tier: "standard",
  },
  "ats-executive": { render: renderAtsExecutive, tier: "standard" },
  "ats-compact": { render: renderAtsCompact, tier: "basic" },
  "two-column-compact": { render: renderTwoColumnCompact, tier: "standard" },
  "minimalist-creative": { render: renderMinimalistCreative, tier: "standard" },
  "executive-senior": { render: renderExecutiveSenior, tier: "basic" },
  aurora: { render: renderAurora, tier: "premium" },
  vibrant: { render: renderVibrant, tier: "elite" },
  editorial: { render: renderEditorial, tier: "elite" },
  "designer-studio": { render: renderDesignerStudio, tier: "flagship" },
  graphite: { render: renderGraphite, tier: "premium" },
  onyx: { render: renderOnyx, tier: "elite" },
  bloom: { render: renderBloom, tier: "flagship" },
};
