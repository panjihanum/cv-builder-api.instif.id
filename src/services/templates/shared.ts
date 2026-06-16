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

export function joinNonEmpty(parts: string[], separator: string): string {
  return parts.filter((part) => part.trim().length > 0).join(separator);
}

export function formatDateRange(
  startDate: string,
  endDate: string,
  current: boolean
): string {
  const end = current ? "Present" : endDate;
  return joinNonEmpty([startDate, end], " - ");
}

/**
 * Shared print-pagination rules appended to every template so multi-page CVs
 * break cleanly: an individual entry / list item / skill never splits across a
 * page boundary, and a section heading is never orphaned at the foot of a page.
 * Only small, indivisible items get `break-inside: avoid` — never sections,
 * sidebars or columns, which must be allowed to flow across pages.
 */
const PAGINATION_CSS = [
  "h1,h2,h3,h4,h5,h6,.sec-h,.s-h{break-after:avoid;page-break-after:avoid;}",
  "header,.header,.namehead,.head,.hero,.profile{break-inside:avoid;page-break-inside:avoid;}",
  ".entry,.blk,.bar-row,.si,article,li,.skill-item,.skill-grid .si,.cert,.lang{break-inside:avoid;page-break-inside:avoid;}",
  "img{break-inside:avoid;page-break-inside:avoid;}",
  // Top/bottom whitespace is supplied per page by the PDF page margin (see
  // pdf.service), so the document itself must not add vertical body padding —
  // otherwise the first/last page would be padded twice and inner page breaks
  // not at all. Horizontal body padding is kept (it applies to every page).
  "body{padding-top:0;padding-bottom:0;}",
].join("");

export function documentShell(
  title: string,
  css: string,
  body: string
): string {
  return [
    "<!doctype html>",
    '<html lang="id">',
    '<head><meta charset="utf-8" />',
    `<title>${escapeHtml(title || "CV")}</title>`,
    `<style>${css}\n${PAGINATION_CSS}</style>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
  ].join("");
}
