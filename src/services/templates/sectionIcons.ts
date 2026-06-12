/**
 * Section-header icons for icon-rich PDF templates.
 *
 * Mirrors the frontend registry (cv-builder: src/config/sectionIcons.tsx).
 * Raw SVG paths for a "0 0 24 24" viewBox drawn with fill.
 */

export type SectionIconKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "languages"
  | "custom";

export const SECTION_ICONS: Record<SectionIconKey, string> = {
  summary:
    "M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6z",
  experience:
    "M9 3a2 2 0 00-2 2v1H3a1 1 0 00-1 1v12a1 1 0 001 1h18a1 1 0 001-1V7a1 1 0 00-1-1h-4V5a2 2 0 00-2-2H9zm0 2h6v1H9V5zM4 8h16v3H4V8zm0 5h16v6H4v-6z",
  education:
    "M12 3L1 9l4 2.18v5L12 20l7-3.82v-5l2-1.09V17h2V9L12 3zM7 12.27l5 2.73 5-2.73v2.54L12 17.5l-5-2.69v-2.54z",
  skills:
    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  projects:
    "M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6z",
  certifications:
    "M12 1a6 6 0 013 11.19V23l-3-1.8L9 23V12.19A6 6 0 0112 1zm0 2a4 4 0 100 8 4 4 0 000-8z",
  languages:
    "M12 2a10 10 0 100 20 10 10 0 000-20zm6.93 6h-2.95a15.6 15.6 0 00-1.38-3.56A8.03 8.03 0 0118.93 8zM12 4.04A13.9 13.9 0 0113.91 8h-3.82A13.9 13.9 0 0112 4.04zM4.26 14a7.96 7.96 0 010-4h3.38a16.6 16.6 0 000 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 015.07 16zm2.95-8H5.07a7.99 7.99 0 014.33-3.56A15.6 15.6 0 008.02 8zM12 19.96A13.9 13.9 0 0110.09 16h3.82A13.9 13.9 0 0112 19.96zM14.34 14H9.66a14.6 14.6 0 010-4h4.68a14.6 14.6 0 010 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a7.99 7.99 0 01-4.33 3.56zM16.36 14a16.6 16.6 0 000-4h3.38a7.96 7.96 0 010 4h-3.38z",
  custom:
    "M12 2l9 5-9 5-9-5 9-5zm0 7.5L18.5 6 21 7l-9 5-9-5 2.5-1L12 9.5zM3 12l9 5 9-5 2 1.1-11 6.1L1 13.1 3 12zm0 5l9 5 9-5 2 1.1-11 6.1L1 18.1 3 17z",
};

export function sectionIconSvg(key: SectionIconKey, size = 13): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="fill:currentColor;flex-shrink:0;vertical-align:-2px" aria-hidden="true"><path d="${SECTION_ICONS[key]}" /></svg>`;
}
