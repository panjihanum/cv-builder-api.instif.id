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
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 0 48px; }
header.header { border-bottom: 2pt solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
header.header h1 { font-size: 21pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; margin: 0 0 3px; }
header.header .role { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #475569; margin: 0 0 5px; }
header.header .contact { font-size: 8.5pt; color: #64748b; margin: 0; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; border-bottom: 1pt solid #0f172a; padding-bottom: 2px; margin: 0 0 7px; }
.entry { margin-bottom: 9px; }
.entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.entry-head h3 { font-size: 10pt; font-weight: 700; margin: 0; color: #0f172a; }
.entry-head .entry-date { flex-shrink: 0; font-size: 8.5pt; font-weight: 600; color: #334155; }
.entry .meta { font-size: 9pt; font-style: italic; color: #475569; margin: 1px 0 3px; }
ul { margin: 3px 0 0; padding-left: 18px; color: #334155; }
li { margin-bottom: 1.5px; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: "  ·  "; color: #64748b; }
.level { display: none; }
`;

export function renderAtsExecutiveLeadership(data: CvData): string {
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

  // Core Competencies / Skills directly under summary
  const sections = [
    summarySection,
    renderSkillsSection(data, { separator: " · " }),
    renderExperienceSection(data),
    renderEducationSection(data),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderLanguagesSection(data),
    renderCustomSections(data),
  ].join("");

  const body = `<main>${header}${sections}</main>`;
  return documentShell(personal.fullName, css, body, locale);
}
