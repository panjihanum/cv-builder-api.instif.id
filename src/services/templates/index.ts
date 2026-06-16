import type { CvData } from "@/lib/cvData.js";
import type { TemplateTier } from "@/config/pricing.js";
import { renderClassicAts } from "@/services/templates/classic-ats.js";
import { renderCleanSimple } from "@/services/templates/clean-simple.js";
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
import { renderSlate } from "@/services/templates/slate.js";
import { renderMeridian } from "@/services/templates/meridian.js";
import { renderNova } from "@/services/templates/nova.js";
import { renderAtlas } from "@/services/templates/atlas.js";
import { renderMonarch } from "@/services/templates/monarch.js";
import { renderIvory } from "@/services/templates/ivory.js";
import { renderPrestige } from "@/services/templates/prestige.js";
import { renderPrism } from "@/services/templates/prism.js";
import { renderSpectrum } from "@/services/templates/spectrum.js";
import { renderCanvas } from "@/services/templates/canvas.js";

export type TemplateRenderer = (data: CvData) => string;

export interface TemplateEntry {
  render: TemplateRenderer;
  /**
   * Tier biaya visual. Biaya kredit aktualnya diresolusi dari pengaturan admin
   * (DB) saat dipakai, bukan disimpan di sini, agar harga fleksibel per web.
   */
  tier: TemplateTier;
  /**
   * Full-bleed templates have an edge-to-edge sidebar or banner, so the PDF is
   * rendered with zero page margin and they keep no per-page whitespace. Plain
   * single-column templates (the default) get a vertical page margin instead so
   * content never touches the top/bottom edge on any page. See pdf.service.
   */
  fullBleed?: boolean;
}

export const templates: Record<string, TemplateEntry> = {
  "classic-ats": { render: renderClassicAts, tier: "free" },
  "clean-simple": { render: renderCleanSimple, tier: "free" },
  "modern-professional": { render: renderModernProfessional, tier: "basic" },
  "ats-professional": { render: renderAtsProfessional, tier: "basic" },
  "ats-recruiter-focus": {
    render: renderAtsRecruiterFocus,
    tier: "standard",
  },
  "ats-executive": { render: renderAtsExecutive, tier: "standard" },
  "ats-compact": { render: renderAtsCompact, tier: "basic" },
  "two-column-compact": {
    render: renderTwoColumnCompact,
    tier: "standard",
    fullBleed: true,
  },
  "minimalist-creative": { render: renderMinimalistCreative, tier: "standard" },
  "executive-senior": { render: renderExecutiveSenior, tier: "basic" },
  aurora: { render: renderAurora, tier: "premium", fullBleed: true },
  vibrant: { render: renderVibrant, tier: "elite", fullBleed: true },
  editorial: { render: renderEditorial, tier: "elite" },
  "designer-studio": {
    render: renderDesignerStudio,
    tier: "flagship",
    fullBleed: true,
  },
  graphite: { render: renderGraphite, tier: "premium", fullBleed: true },
  onyx: { render: renderOnyx, tier: "elite", fullBleed: true },
  bloom: { render: renderBloom, tier: "flagship" },
  slate: { render: renderSlate, tier: "basic" },
  meridian: { render: renderMeridian, tier: "standard" },
  nova: { render: renderNova, tier: "premium", fullBleed: true },
  atlas: { render: renderAtlas, tier: "premium", fullBleed: true },
  monarch: { render: renderMonarch, tier: "flagship", fullBleed: true },
  ivory: { render: renderIvory, tier: "elite" },
  prestige: { render: renderPrestige, tier: "elite" },
  prism: { render: renderPrism, tier: "flagship", fullBleed: true },
  spectrum: { render: renderSpectrum, tier: "elite" },
  canvas: { render: renderCanvas, tier: "standard" },
};
