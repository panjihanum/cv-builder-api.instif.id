import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import {
  renderContactLine,
  renderSkillsSection,
  renderProjectsSection,
  renderCertificationsSection,
  renderLanguagesSection,
  renderCustomSections,
} from "@/services/templates/sections.js";
import { getCvLabels, normalizeCvLocale } from "@/services/templates/i18n.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #374151; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 44px 52px; }
header.header { padding-bottom: 10px; margin-bottom: 14px; }
header.header h1 { font-size: 20pt; font-weight: 700; color: #111827; margin: 0 0 2px; }
header.header .role { font-size: 9.5pt; color: #6b7280; margin: 0 0 4px; }
header.header .contact { font-size: 8.5pt; color: #6b7280; margin: 0; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 9.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #4b5563; border-bottom: 0.75pt solid #d1d5db; padding-bottom: 2px; margin: 0 0 6px; }
.entry { margin-bottom: 9px; }
.date-row { display: flex; align-items: baseline; gap: 10px; }
.date-badge { font-size: 9.5pt; font-weight: 700; color: #4b5563; white-space: nowrap; flex-shrink: 0; }
.entry-title { font-size: 10pt; font-weight: 600; color: #111827; }
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

function renderCadenceExperienceSection(data: CvData): string {
  if (!data.experience.length) return "";
  const locale = normalizeCvLocale(data.language);
  const t = getCvLabels(locale);

  const entries = data.experience
    .map((item) => {
      const date = formatDateRange(
        item.startDate,
        item.endDate,
        item.current,
        locale
      );
      const dateBadge = date
        ? `<span class="date-badge">${escapeHtml(date)}</span>`
        : "";
      const title = item.position
        ? `<span class="entry-title">${escapeHtml(item.position)}</span>`
        : "";
      const dateRow =
        dateBadge || title
          ? `<div class="date-row">${dateBadge}${title}</div>`
          : "";
      const metaParts = [item.company, item.location].filter((s) => s.trim());
      const meta = metaParts.length
        ? `<p class="meta">${escapeHtml(joinNonEmpty(metaParts, ", "))}</p>`
        : "";
      const desc = renderDescription(item.description);
      return `<div class="entry">${dateRow}${meta}${desc}</div>`;
    })
    .join("");

  return `<section class="section"><h2>${escapeHtml(t.experience)}</h2>${entries}</section>`;
}

function renderCadenceEducationSection(data: CvData): string {
  if (!data.education.length) return "";
  const locale = normalizeCvLocale(data.language);
  const t = getCvLabels(locale);

  const entries = data.education
    .map((item) => {
      const date = formatDateRange(item.startDate, item.endDate, false, locale);
      const dateBadge = date
        ? `<span class="date-badge">${escapeHtml(date)}</span>`
        : "";
      const title = item.institution
        ? `<span class="entry-title">${escapeHtml(item.institution)}</span>`
        : "";
      const dateRow =
        dateBadge || title
          ? `<div class="date-row">${dateBadge}${title}</div>`
          : "";
      const degreeField = joinNonEmpty(
        [item.degree, item.field].filter(Boolean),
        " — "
      );
      const gpaStr = item.gpa ? `${t.gpa} ${item.gpa}` : "";
      const metaStr = joinNonEmpty([degreeField, gpaStr], " · ");
      const meta = metaStr ? `<p class="meta">${escapeHtml(metaStr)}</p>` : "";
      return `<div class="entry">${dateRow}${meta}</div>`;
    })
    .join("");

  return `<section class="section"><h2>${escapeHtml(t.education)}</h2>${entries}</section>`;
}

export function renderAtsCadence(data: CvData): string {
  const { personal } = data;
  const locale = normalizeCvLocale(data.language);
  const t = getCvLabels(locale);
  const name = escapeHtml(personal.fullName);
  const role = personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>`
    : "";
  const contactLine = renderContactLine(data);
  const contact = contactLine ? `<p class="contact">${contactLine}</p>` : "";

  const header = `<header class="header">
    <h1>${name}</h1>
    ${role}
    ${contact}
  </header>`;

  const summarySection = data.summary.trim()
    ? `<section class="section"><h2>${escapeHtml(t.summary)}</h2>${renderSummary(data.summary)}</section>`
    : "";

  const sections = [
    summarySection,
    renderCadenceExperienceSection(data),
    renderCadenceEducationSection(data),
    renderSkillsSection(data),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderLanguagesSection(data),
    renderCustomSections(data),
  ].join("");

  const body = `<main>${header}${sections}</main>`;
  return documentShell(personal.fullName, css, body, locale);
}
