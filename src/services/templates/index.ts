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
import { renderEmber } from "@/services/templates/ember.js";
import { renderGraphite } from "@/services/templates/graphite.js";
import { renderOnyx } from "@/services/templates/onyx.js";
import { renderBloom } from "@/services/templates/bloom.js";
import { renderPortrait } from "@/services/templates/portrait.js";
import { renderSilhouette } from "@/services/templates/silhouette.js";
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
import { renderAtsBeacon } from "@/services/templates/ats-beacon.js";
import { renderAtsVeritas } from "@/services/templates/ats-veritas.js";
import { renderAtsLumen } from "@/services/templates/ats-lumen.js";
import { renderAtsCobalt } from "@/services/templates/ats-cobalt.js";
import { renderAtsQuartz } from "@/services/templates/ats-quartz.js";
import { renderAtsFoundry } from "@/services/templates/ats-foundry.js";
import { renderAtsMarlowe } from "@/services/templates/ats-marlowe.js";
import { renderAtsPace } from "@/services/templates/ats-pace.js";
import { renderAtsLedger } from "@/services/templates/ats-ledger.js";
import { renderAtsStride } from "@/services/templates/ats-stride.js";
import { renderAtsHalcyon } from "@/services/templates/ats-halcyon.js";
import { renderAtsOnset } from "@/services/templates/ats-onset.js";
import { renderAtsCadence } from "@/services/templates/ats-cadence.js";
import { renderAtsPillar } from "@/services/templates/ats-pillar.js";
import { renderAtsDrift } from "@/services/templates/ats-drift.js";
import { renderAtsCresset } from "@/services/templates/ats-cresset.js";
import { renderAtsBrevity } from "@/services/templates/ats-brevity.js";
import { renderAtsAnchor } from "@/services/templates/ats-anchor.js";
import { renderAtsSterling } from "@/services/templates/ats-sterling.js";
import { renderAtsVantage } from "@/services/templates/ats-vantage.js";

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
  ember: { render: renderEmber, tier: "standard" },
  silhouette: { render: renderSilhouette, tier: "premium", fullBleed: true },
  portrait: { render: renderPortrait, tier: "elite", fullBleed: true },
  "ats-beacon": { render: renderAtsBeacon, tier: "basic" },
  "ats-veritas": { render: renderAtsVeritas, tier: "standard" },
  "ats-lumen": { render: renderAtsLumen, tier: "basic" },
  "ats-cobalt": { render: renderAtsCobalt, tier: "basic" },
  "ats-quartz": { render: renderAtsQuartz, tier: "standard" },
  "ats-foundry": { render: renderAtsFoundry, tier: "standard" },
  "ats-marlowe": { render: renderAtsMarlowe, tier: "premium" },
  "ats-pace": { render: renderAtsPace, tier: "standard" },
  "ats-ledger": { render: renderAtsLedger, tier: "standard" },
  "ats-stride": { render: renderAtsStride, tier: "basic" },
  "ats-halcyon": { render: renderAtsHalcyon, tier: "premium" },
  "ats-onset": { render: renderAtsOnset, tier: "free" },
  "ats-cadence": { render: renderAtsCadence, tier: "standard" },
  "ats-pillar": { render: renderAtsPillar, tier: "premium" },
  "ats-drift": { render: renderAtsDrift, tier: "standard" },
  "ats-cresset": { render: renderAtsCresset, tier: "standard" },
  "ats-brevity": { render: renderAtsBrevity, tier: "basic" },
  "ats-anchor": { render: renderAtsAnchor, tier: "standard" },
  "ats-sterling": { render: renderAtsSterling, tier: "elite" },
  "ats-vantage": { render: renderAtsVantage, tier: "premium" },
};
