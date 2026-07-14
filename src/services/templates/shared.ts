import {
  defaultCvLocale,
  formatCvMonth,
  getPresentWord,
  type CvLocale,
} from "@/services/templates/i18n.js";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMultiline(value: string): string {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

/** Render newline-separated text as a bullet list (matches the live preview). */
export function renderBullets(value: string, className = ""): string {
  const items = value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
  if (!items) return "";
  const cls = className ? ` class="${className}"` : "";
  return `<ul${cls}>${items}</ul>`;
}

/**
 * Render a description field that may be HTML (from the rich text editor) or
 * legacy plain text (newline-separated bullets).
 * TipTap always wraps content in <p>, <ul>, or <ol> — use that as the signal.
 */
export function renderDescription(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^<(p|ul|ol)[\s>]/i.test(trimmed)) {
    // HTML from TipTap rich text editor — strip dangerous tags/attrs
    return trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\bon\w+\s*=/gi, "data-removed=");
  }
  return renderBullets(trimmed);
}

/**
 * Render the summary field which now accepts rich text (TipTap HTML) or legacy
 * plain text. Unlike renderDescription, plain text is rendered as a paragraph
 * with line breaks (not bullet points).
 * Optional wrapperClass is applied to the outer element so callers can pass
 * colour/spacing classes (e.g. "muted") without coupling to the tag name.
 */
export function renderSummary(value: string, wrapperClass?: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const cls = wrapperClass ? ` class="${wrapperClass}"` : "";
  if (/^<(p|ul|ol)[\s>]/i.test(trimmed)) {
    const sanitized = trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\bon\w+\s*=/gi, "data-removed=");
    return wrapperClass ? `<div${cls}>${sanitized}</div>` : sanitized;
  }
  return `<p${cls}>${renderMultiline(trimmed)}</p>`;
}

export function joinNonEmpty(parts: string[], separator: string): string {
  return parts.filter((part) => part.trim().length > 0).join(separator);
}

export function formatDateRange(
  startDate: string,
  endDate: string,
  current: boolean,
  locale: CvLocale = defaultCvLocale
): string {
  const start = startDate ? formatCvMonth(startDate, locale) : "";
  const end = current
    ? getPresentWord(locale)
    : endDate
      ? formatCvMonth(endDate, locale)
      : "";
  return joinNonEmpty([start, end], " - ");
}

/**
 * Shared print-pagination rules appended to every template so multi-page CVs
 * break cleanly: an individual entry / list item / skill never splits across a
 * page boundary, and a section heading is never orphaned at the foot of a page.
 * Only small, indivisible items get `break-inside: avoid` — never sections,
 * sidebars or columns, which must be allowed to flow across pages.
 */
const PAGINATION_CSS = [
  // Section headings + entry sub-headings stay with the next line so they're
  // never orphaned at the foot of a page. .meta = company/date row inside .entry.
  "h1,h2,h3,h4,h5,h6,.meta,.sec-h,.s-h,.skill-cat,.entry-head{break-after:avoid;page-break-after:avoid;}",
  // Shared entry heading row used by the generic section renderers: the title
  // (position/institution) on the left, the date range right-aligned on the same
  // baseline — mirroring the live preview's [bold title | date] flex row. The
  // date rules are scoped to `.entry-head` so templates with their own bespoke
  // `.entry-date` (e.g. clean-simple) are untouched.
  ".entry-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}",
  ".entry-head h3{margin:0;}",
  ".entry-head .entry-date{flex-shrink:0;font-weight:400;font-size:0.86em;}",
  // Skill category heading — shared default so every template gets a tasteful
  // grouping label without per-template CSS. Templates may override .skill-cat
  // (colour/size) in their own stylesheet; it inherits the surrounding colour.
  ".skill-cat{margin:0 0 3px;font-size:0.82em;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;opacity:0.72;}",
  ".skill-cat+ul,.skill-cat+ol{margin-top:0;}",
  // A category block (heading + its skills) stays together where it can.
  ".skill-group{break-inside:avoid;page-break-inside:avoid;margin-bottom:6px;}",
  "header,.header,.namehead,.head,.hero,.profile{break-inside:avoid;page-break-inside:avoid;}",
  // .entry and article are NOT kept together — their bullets may flow across
  // pages. Individual li items stay intact, headers stay with their .meta row.
  ".blk,.bar-row,.si,li,.skill-item,.skill-grid .si,.skill-line,.cert,.lang{break-inside:avoid;page-break-inside:avoid;}",
  "img{break-inside:avoid;page-break-inside:avoid;}",
  // Top/bottom whitespace is supplied per page by the PDF page margin (see
  // pdf.service), so the document itself must not add vertical body padding —
  // otherwise the first/last page would be padded twice and inner page breaks
  // not at all. Horizontal body padding is kept (it applies to every page).
  "body{padding-top:0;padding-bottom:0;}",
  // Full-bleed sidebar templates use Puppeteer margin=0 so the sidebar/main
  // containers own all vertical spacing. box-decoration-break:clone makes each
  // page fragment re-apply its padding-top/bottom and background, giving the
  // same py-6 breathing room on page 2+ that page 1 gets from the container start.
  ".sidebar,.main,.aside{-webkit-box-decoration-break:clone;box-decoration-break:clone;}",
].join("");

export function documentShell(
  title: string,
  css: string,
  body: string,
  locale: CvLocale = defaultCvLocale
): string {
  return [
    "<!doctype html>",
    `<html lang="${locale}">`,
    '<head><meta charset="utf-8" />',
    `<title>${escapeHtml(title || "CV")}</title>`,
    `<style>${css}\n${PAGINATION_CSS}</style>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
  ].join("");
}
