export const DEFAULT_PACK_PRICE = 13000;
export const DEFAULT_ORIGINAL_PACK_PRICE = 25000;
export const DEFAULT_CREDITS_PER_PACK = 15;
export const DEFAULT_MAX_PACKS_PER_ORDER = 10;

export const CREDIT_COSTS = {
  // Biaya kredit template per tier visual — makin menonjol/kreatif makin mahal.
  // Harus selaras dengan FE siteConfig.pricing.costs.templateTier.
  templateTier: {
    free: 0,
    basic: 4,
    standard: 6,
    premium: 8,
    elite: 10,
    flagship: 12,
  },
  aiParse: 2,
  aiSectionImprove: 1,
  aiPolish: 5,
} as const;

/** Nama tier biaya template (urut termurah → termahal). */
export const TEMPLATE_TIERS = [
  "free",
  "basic",
  "standard",
  "premium",
  "elite",
  "flagship",
] as const;

export type TemplateTier = (typeof TEMPLATE_TIERS)[number];
