import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  renderSummary,
} from "@/services/templates/shared.js";
import {
  renderExperienceSection,
  renderEducationSection,
  renderSkillsSection,
  renderProjectsSection,
  renderCertificationsSection,
  renderLanguagesSection,
  renderCustomSections,
} from "@/services/templates/sections.js";
import { getCvLabels, normalizeCvLocale } from "@/services/templates/i18n.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #374151; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 44px 52px; }
header.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2pt solid #111827; padding-bottom: 12px; margin-bottom: 15px; }
.header-left { flex: 1; }
.header-right { flex-shrink: 0; text-align: right; }
header.header h1 { font-size: 20pt; font-weight: 800; color: #111827; margin: 0 0 2px; line-height: 1.1; }
header.header .role { font-size: 9.5pt; font-weight: 500; color: #6b7280; margin: 0; }
.contact-item { font-size: 8.5pt; color: #6b7280; margin: 0 0 1px; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #111827; border-bottom: 2pt solid #111827; padding-bottom: 2px; margin: 0 0 6px; }
.entry { margin-bottom: 8px; }
.entry h3 { font-size: 10pt; margin: 0; font-weight: 700; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #6b7280; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 16px; color: #374151; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsVantage(data: CvData): string {
  const { personal } = data;
  const locale = normalizeCvLocale(data.language);
  const t = getCvLabels(locale);
  const name = escapeHtml(personal.fullName);
  const role = personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>`
    : "";

  // Right column: each contact part and each link on its own line, matching the
  // preview's stacked layout. (Base parts and links are listed once — no merge.)
  const baseParts = [personal.email, personal.phone, personal.address]
    .filter((part) => part.trim().length > 0)
    .map(escapeHtml);
  const linkParts = personal.links
    .map((l) =>
      l.label && l.url
        ? `${escapeHtml(l.label)}: ${escapeHtml(l.url)}`
        : escapeHtml(l.url)
    )
    .filter(Boolean);

  const contactItems = [...baseParts, ...linkParts]
    .map((item) => `<p class="contact-item">${item}</p>`)
    .join("");

  const header = `<header class="header">
    <div class="header-left">
      <h1>${name}</h1>
      ${role}
    </div>
    <div class="header-right">${contactItems}</div>
  </header>`;

  const summarySection = data.summary.trim()
    ? `<section class="section"><h2>${escapeHtml(t.summary)}</h2>${renderSummary(data.summary)}</section>`
    : "";

  const sections = [
    summarySection,
    renderExperienceSection(data),
    renderEducationSection(data),
    renderSkillsSection(data),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderLanguagesSection(data),
    renderCustomSections(data),
  ].join("");

  const body = `<main>${header}${sections}</main>`;
  return documentShell(personal.fullName, css, body, locale);
}
