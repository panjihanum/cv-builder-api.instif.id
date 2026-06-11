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
