import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  renderSummary,
} from "@/services/templates/shared.js";
import {
  renderEducationSection,
  renderExperienceSection,
  renderSkillsSection,
  renderProjectsSection,
  renderCertificationsSection,
  renderLanguagesSection,
  renderCustomSections,
} from "@/services/templates/sections.js";
import { getCvLabels, normalizeCvLocale } from "@/services/templates/i18n.js";

const css = `
body { font-family: "Times New Roman", Times, Georgia, serif; color: #111827; font-size: 10pt; line-height: 1.5; margin: 0; min-height: 100vh; padding: 0 48px; }
header.header { text-align: center; border-bottom: 1pt solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
header.header h1 { font-size: 20pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #111827; margin: 0 0 3px; }
header.header .role { font-size: 9.5pt; font-weight: 500; text-transform: uppercase; letter-spacing: 2.5px; color: #374151; margin: 0 0 5px; }
header.header .contact { font-size: 8.5pt; color: #4b5563; margin: 0; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #111827; border-bottom: 1pt solid #111827; padding-bottom: 2px; margin: 0 0 6px; }
.entry { margin-bottom: 8px; }
.entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.entry-head h3 { font-size: 10pt; font-weight: 700; margin: 0; color: #111827; }
.entry-head .entry-date { flex-shrink: 0; font-size: 8.5pt; color: #4b5563; }
.entry .meta { font-size: 9pt; font-style: italic; color: #374151; margin: 1px 0 3px; }
ul { margin: 3px 0 0; padding-left: 18px; color: #1f2937; }
li { margin-bottom: 1.5px; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #6b7280; }
.level { display: none; }
`;

export function renderAtsIvyLeague(data: CvData): string {
  const { personal } = data;
  const locale = normalizeCvLocale(data.language);
  const t = getCvLabels(locale);
  const name = escapeHtml(personal.fullName);
  const role = personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>`
    : "";

  const baseParts = [personal.email, personal.phone, personal.address]
    .filter((p) => p.trim().length > 0)
    .map(escapeHtml);
  const linkParts = personal.links
    .map((l) =>
      l.label && l.url
        ? `${escapeHtml(l.label)}: ${escapeHtml(l.url)}`
        : escapeHtml(l.url)
    )
    .filter(Boolean);

  const contactLine = [...baseParts, ...linkParts].join("  •  ");
  const contact = contactLine ? `<p class="contact">${contactLine}</p>` : "";
  const header = `<header class="header"><h1>${name}</h1>${role}${contact}</header>`;

  const summarySection = data.summary.trim()
    ? `<section class="section"><h2>${escapeHtml(t.summary)}</h2>${renderSummary(data.summary)}</section>`
    : "";

  const sections = [
    summarySection,
    renderExperienceSection(data),
    renderEducationSection(data),
    renderSkillsSection(data, { separator: " · " }),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderLanguagesSection(data),
    renderCustomSections(data),
  ].join("");

  const body = `<main>${header}${sections}</main>`;
  return documentShell(personal.fullName, css, body, locale);
}
