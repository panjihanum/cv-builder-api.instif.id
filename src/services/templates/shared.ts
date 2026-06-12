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
    `<style>${css}</style>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
  ].join("");
}
